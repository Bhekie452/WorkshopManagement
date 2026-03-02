"""Backfill in-memory `_invoice_items` into the persistent database.

Run this script from the project root (same environment as the app):

  python backend/scripts/backfill_invoice_items.py          # Normal mode (applies changes)
  python backend/scripts/backfill_invoice_items.py --dry-run  # Dry-run mode (preview only)

It will import the running code, read `_invoice_items` from `backend.api.main`, and
insert any missing `invoice_items` into the DB, updating invoice totals.

Idempotent: Safe to run multiple times; skips items that already exist in DB.
"""
import sys
from pathlib import Path
import logging
import argparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description='Backfill invoice items from memory to database.')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes without applying them.')
    args = parser.parse_args()

    try:
        from backend.api import main as api_main
    except Exception as e:
        logger.error("Failed to import backend.api.main: %s", e)
        return

    if not getattr(api_main, 'DB_AVAILABLE', False):
        logger.error("Database is not available. Ensure DATABASE_URL is configured and DB is reachable.")
        return

    # Import DB helpers and models
    try:
        from db.database import get_db_context
        from db.models import Invoice as DBInvoice, InvoiceItem as DBInvoiceItem
    except Exception as e:
        logger.error("Failed to import DB modules: %s", e)
        return

    invoice_items_store = getattr(api_main, '_invoice_items', None)
    if not invoice_items_store or not any(invoice_items_store.values()):
        logger.info("No in-memory invoice items found. Nothing to backfill.")
        return

    logger.info("Starting backfill process... (dry-run: %s)", args.dry_run)
    
    total_items = sum(len(items) for items in invoice_items_store.values())
    logger.info("Found %d items to process across companies.", total_items)

    total_inserted = 0
    total_skipped = 0
    total_invoices_updated = 0

    try:
        with get_db_context() as db:
            for company_id, items_map in invoice_items_store.items():
                logger.info("Processing %d items for company %s", len(items_map), company_id)
                
                for item_id, item in items_map.items():
                    invoice_id = item.get('invoice_id')
                    
                    # Check whether invoice exists in DB
                    db_inv = db.query(DBInvoice).filter(DBInvoice.id == invoice_id).first()
                    if not db_inv:
                        logger.warning("  Item %s: Invoice %s not found in DB (company %s) — skipping", item_id, invoice_id, company_id)
                        total_skipped += 1
                        continue

                    # Check if item already exists
                    exists = db.query(DBInvoiceItem).filter(DBInvoiceItem.id == item_id).first()
                    if exists:
                        logger.info("  Item %s: Already exists in DB — skipping", item_id)
                        total_skipped += 1
                        continue

                    # Prepare item for insert
                    logger.info("  Item %s: Will insert into DB (description: %s, qty: %s, price: %.2f)", 
                                item_id, item.get('description', 'N/A'), item.get('quantity', 0), item.get('unit_price', 0.0))
                    
                    if not args.dry_run:
                        db_item = DBInvoiceItem(
                            id=item_id,
                            invoice_id=invoice_id,
                            description=item.get('description', ''),
                            quantity=item.get('quantity', 0),
                            unit_price=item.get('unit_price', 0.0),
                            total=item.get('total', 0.0)
                        )
                        db.add(db_item)
                    total_inserted += 1

            if not args.dry_run:
                logger.info("Committing %d items to database...", total_inserted)
                db.commit()
            
            # Recalculate totals for affected invoices
            affected_invoices = set(
                it.get('invoice_id')
                for comp in invoice_items_store.values()
                for it in comp.values()
            )
            
            for inv_id in affected_invoices:
                db_inv = db.query(DBInvoice).filter(DBInvoice.id == inv_id).first()
                if not db_inv:
                    continue
                
                items = db.query(DBInvoiceItem).filter(DBInvoiceItem.invoice_id == inv_id).all()
                old_total = db_inv.total
                subtotal = sum(i.total for i in items)
                tax_rate = getattr(db_inv, 'tax_rate', 0.15)
                discount = getattr(db_inv, 'discount', 0)
                
                db_inv.subtotal = subtotal
                db_inv.tax_amount = subtotal * tax_rate
                db_inv.total = db_inv.subtotal + db_inv.tax_amount - discount
                
                logger.info("  Invoice %s: Recalculated totals (subtotal: %.2f, tax: %.2f, total: %.2f -> %.2f)", 
                            inv_id, subtotal, db_inv.tax_amount, old_total, db_inv.total)
                total_invoices_updated += 1
            
            if not args.dry_run and total_invoices_updated > 0:
                logger.info("Committing invoice total updates...")
                db.commit()
    
    except Exception as e:
        logger.error("Backfill failed: %s", e)
        raise

    logger.info("")
    logger.info("=" * 60)
    logger.info("Backfill Summary:")
    logger.info("  Items inserted: %d", total_inserted)
    logger.info("  Items skipped: %d", total_skipped)
    logger.info("  Invoices updated: %d", total_invoices_updated)
    logger.info("  Dry-run mode: %s", "YES" if args.dry_run else "NO")
    logger.info("=" * 60)
    logger.info("")
    
    if args.dry_run:
        logger.info("✓ Dry-run complete. Review above and run without --dry-run to apply changes.")
    else:
        logger.info("✓ Backfill complete.")


if __name__ == '__main__':
    main()
