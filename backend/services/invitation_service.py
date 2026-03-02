"""User Invitation Service - Handle email-based user signup workflow.

This module provides services for:
1. Creating and managing user invitations
2. Generating secure invitation tokens
3. Sending invitation emails
4. Processing invitation acceptance
5. Validating and expiring invitations
"""

import secrets
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import UserInvitation, User, Company
from services.email_service import email_service


class InvitationService:
    """Service for managing user invitations."""
    
    # Token generation
    TOKEN_LENGTH = 32  # 256-bit tokens
    EXPIRY_DAYS = 7  # Invitations expire after 7 days
    
    @staticmethod
    def generate_token() -> str:
        """Generate a secure random token for invitation link."""
        return secrets.token_urlsafe(InvitationService.TOKEN_LENGTH)
    
    @staticmethod
    def get_expiry_time() -> datetime:
        """Calculate invitation expiry time (7 days from now)."""
        return datetime.utcnow() + timedelta(days=InvitationService.EXPIRY_DAYS)
    
    @staticmethod
    async def create_invitation(
        session: AsyncSession,
        company_id: str,
        email: str,
        role: str = "TECHNICIAN",
        base_url: str = "http://localhost:5173"
    ) -> Optional[UserInvitation]:
        """Create a new user invitation.
        
        Args:
            session: Async database session
            company_id: Company ID for the invitation
            email: Email address of person being invited
            role: Role to assign (default: TECHNICIAN)
            base_url: Base URL for invitation link
            
        Returns:
            UserInvitation object if created, None if email already exists
        """
        # Check if email already exists in users
        result = await session.execute(
            select(User).where(User.email == email)
        )
        if result.scalars().first():
            return None  # Email already registered
        
        # Check if invitation already exists
        result = await session.execute(
            select(UserInvitation).where(
                UserInvitation.email == email,
                UserInvitation.company_id == company_id,
                UserInvitation.accepted_at == None
            )
        )
        if result.scalars().first():
            return None  # Invitation already exists
        
        # Create new invitation
        token = InvitationService.generate_token()
        invitation = UserInvitation(
            company_id=company_id,
            email=email,
            role=role,
            token=token,
            expires_at=InvitationService.get_expiry_time()
        )
        
        session.add(invitation)
        await session.flush()
        
        # Send invitation email asynchronously
        asyncio.create_task(
            InvitationService._send_invitation_email(email, token, base_url)
        )
        
        return invitation
    
    @staticmethod
    async def _send_invitation_email(email: str, token: str, base_url: str) -> None:
        """Send invitation email with signup link.
        
        Args:
            email: Recipient email
            token: Invitation token
            base_url: Base URL for invitation link
        """
        invitation_url = f"{base_url}/accept-invitation/{token}"
        
        subject = "You're invited to join Workshop Management"
        
        html_content = f"""
        <html>
            <body>
                <h2>Welcome to Workshop Management!</h2>
                <p>You've been invited to join our workshop management system.</p>
                
                <p>Click the link below to create your account and get started:</p>
                
                <p>
                    <a href="{invitation_url}" style="display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">
                        Accept Invitation
                    </a>
                </p>
                
                <p>Or copy and paste this link: <br>
                <code>{invitation_url}</code></p>
                
                <p><strong>This link expires in 7 days.</strong></p>
                
                <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                
                <p>Best regards,<br>
                Workshop Management Team</p>
            </body>
        </html>
        """
        
        try:
            await email_service.send_email(
                to_email=email,
                subject=subject,
                html_content=html_content
            )
        except Exception as e:
            print(f"Error sending invitation email to {email}: {e}")
    
    @staticmethod
    async def get_invitation_by_token(
        session: AsyncSession,
        token: str
    ) -> Optional[UserInvitation]:
        """Get invitation by token.
        
        Args:
            session: Async database session
            token: Invitation token
            
        Returns:
            UserInvitation if found and valid, None otherwise
        """
        result = await session.execute(
            select(UserInvitation).where(UserInvitation.token == token)
        )
        invitation = result.scalars().first()
        
        if not invitation:
            return None
        
        # Check if expired
        if invitation.expires_at < datetime.utcnow():
            return None  # Expired
        
        # Check if already accepted
        if invitation.accepted_at:
            return None  # Already accepted
        
        return invitation
    
    @staticmethod
    async def accept_invitation(
        session: AsyncSession,
        token: str,
        user_data: Dict[str, Any]
    ) -> tuple[bool, str]:
        """Accept an invitation and create user account.
        
        Args:
            session: Async database session
            token: Invitation token
            user_data: User details {name, password_hash}
            
        Returns:
            Tuple (success: bool, message: str)
        """
        invitation = await InvitationService.get_invitation_by_token(session, token)
        
        if not invitation:
            return False, "Invalid or expired invitation"
        
        # Check if email already taken
        result = await session.execute(
            select(User).where(User.email == invitation.email)
        )
        if result.scalars().first():
            return False, "Email already registered"
        
        # Create user
        try:
            user = User(
                company_id=invitation.company_id,
                email=invitation.email,
                name=user_data.get("name", ""),
                password_hash=user_data.get("password_hash", ""),
                role=invitation.role,
                email_verified=True
            )
            
            session.add(user)
            
            # Mark invitation as accepted
            invitation.accepted_at = datetime.utcnow()
            session.add(invitation)
            
            await session.flush()
            
            return True, "Account created successfully"
        except Exception as e:
            return False, f"Error creating account: {str(e)}"
    
    @staticmethod
    async def get_pending_invitations(
        session: AsyncSession,
        company_id: str
    ) -> list[Dict[str, Any]]:
        """Get all pending invitations for a company.
        
        Args:
            session: Async database session
            company_id: Company ID
            
        Returns:
            List of pending invitation details
        """
        result = await session.execute(
            select(UserInvitation).where(
                UserInvitation.company_id == company_id,
                UserInvitation.accepted_at == None
            ).order_by(UserInvitation.created_at.desc())
        )
        
        invitations = result.scalars().all()
        
        return [
            {
                "id": inv.id,
                "email": inv.email,
                "role": inv.role,
                "created_at": inv.created_at.isoformat(),
                "expires_at": inv.expires_at.isoformat(),
                "is_expired": inv.expires_at < datetime.utcnow()
            }
            for inv in invitations
        ]
    
    @staticmethod
    async def cancel_invitation(
        session: AsyncSession,
        company_id: str,
        invitation_id: str
    ) -> tuple[bool, str]:
        """Cancel an invitation.
        
        Args:
            session: Async database session
            company_id: Company ID (for authorization)
            invitation_id: Invitation ID
            
        Returns:
            Tuple (success: bool, message: str)
        """
        result = await session.execute(
            select(UserInvitation).where(
                UserInvitation.id == invitation_id,
                UserInvitation.company_id == company_id
            )
        )
        
        invitation = result.scalars().first()
        
        if not invitation:
            return False, "Invitation not found"
        
        if invitation.accepted_at:
            return False, "Cannot cancel accepted invitation"
        
        try:
            await session.delete(invitation)
            await session.flush()
            return True, "Invitation cancelled"
        except Exception as e:
            return False, f"Error cancelling invitation: {str(e)}"


# Global service instance
invitation_service = InvitationService()
