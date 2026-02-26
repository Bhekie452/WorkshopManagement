"""
EV Battery Remaining Useful Life (RUL) Prediction Model

This module provides a scikit-learn based model for predicting
the remaining useful life of electric vehicle batteries.

Features used for prediction:
- State of Health (SOH) percentage
- Charge cycle count
- Average temperature during use
- Fast charge ratio (% of fast charges)
- Age in months
- Average depth of discharge
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
import joblib
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import json


class EVBatteryRULModel:
    """
    EV Battery Remaining Useful Life Prediction Model
    
    Uses Gradient Boosting Regression to predict how many more months/cycles
    a battery has remaining before it reaches end-of-life (typically 70-80% SOH).
    """
    
    # Feature definitions
    FEATURE_NAMES = [
        'current_soh',           # Current State of Health (0-100%)
        'cycle_count',           # Number of charge cycles
        'avg_temperature',       # Average operating temperature (°C)
        'fast_charge_ratio',     # Ratio of fast charges (0-1)
        'age_months',            # Battery age in months
        'avg_dod',               # Average Depth of Discharge (0-100%)
        'capacity_kwh',          # Battery capacity in kWh
        'ambient_temp_avg',      # Average ambient temperature
    ]
    
    # Default EOL threshold (State of Health %)
    EOL_THRESHOLD = 70.0
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize the RUL model.
        
        Args:
            model_path: Path to a pre-trained model file (.joblib)
        """
        self.model: Optional[Pipeline] = None
        self.scaler = StandardScaler()
        self.is_trained = False
        self.training_metrics: Dict = {}
        
        if model_path and Path(model_path).exists():
            self.load(model_path)
    
    def _create_model(self) -> Pipeline:
        """Create the ML pipeline with preprocessing and model."""
        return Pipeline([
            ('scaler', StandardScaler()),
            ('regressor', GradientBoostingRegressor(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.1,
                min_samples_split=10,
                min_samples_leaf=5,
                subsample=0.8,
                random_state=42,
                validation_fraction=0.1,
                n_iter_no_change=15,
            ))
        ])
    
    def generate_synthetic_data(self, n_samples: int = 1000) -> pd.DataFrame:
        """
        Generate synthetic training data for the model.
        
        This simulates realistic battery degradation patterns.
        In production, this would be replaced with real battery data.
        """
        np.random.seed(42)
        
        # Generate features with realistic distributions
        data = {
            'current_soh': np.random.uniform(70, 100, n_samples),
            'cycle_count': np.random.randint(50, 2000, n_samples),
            'avg_temperature': np.random.normal(25, 10, n_samples),
            'fast_charge_ratio': np.random.uniform(0, 0.8, n_samples),
            'age_months': np.random.randint(1, 120, n_samples),
            'avg_dod': np.random.uniform(20, 90, n_samples),
            'capacity_kwh': np.random.choice([40, 60, 75, 82, 100], n_samples),
            'ambient_temp_avg': np.random.normal(22, 8, n_samples),
        }
        
        df = pd.DataFrame(data)
        
        # Generate target: Remaining Useful Life (months until EOL)
        # Based on degradation model:
        # RUL = f(current_soh, cycle_rate, temperature_factor, age)
        
        # Calculate estimated RUL
        soh_margin = (df['current_soh'] - self.EOL_THRESHOLD) / 100
        
        # Degradation rate factors
        cycle_factor = 1 - (df['cycle_count'] / 3000)  # More cycles = faster degradation
        temp_factor = 1 - np.abs(df['avg_temperature'] - 25) / 50  # Optimal at 25°C
        fast_charge_penalty = 1 - (df['fast_charge_ratio'] * 0.3)  # Fast charging degrades faster
        dod_factor = 1 - (df['avg_dod'] - 50) / 100  # Deep discharges are worse
        
        # Combine factors
        degradation_modifier = (cycle_factor * temp_factor * fast_charge_penalty * dod_factor)
        degradation_modifier = np.clip(degradation_modifier, 0.3, 1.0)
        
        # Base RUL based on SOH margin, modified by degradation rate
        # Higher SOH = more remaining life
        base_rul = soh_margin * 120  # Max ~36 months if at 100% SOH
        df['rul_months'] = np.maximum(0, base_rul * degradation_modifier + np.random.normal(0, 3, n_samples))
        
        # Add some realistic noise
        df['rul_months'] = df['rul_months'].clip(0, 120)
        
        return df
    
    def train(self, X: np.ndarray, y: np.ndarray) -> Dict:
        """
        Train the RUL prediction model.
        
        Args:
            X: Feature matrix (n_samples, n_features)
            y: Target values (RUL in months)
            
        Returns:
            Dictionary with training metrics
        """
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Create and train model
        self.model = self._create_model()
        self.model.fit(X_train, y_train)
        
        # Evaluate
        y_pred_train = self.model.predict(X_train)
        y_pred_test = self.model.predict(X_test)
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X, y, cv=5, scoring='neg_mean_absolute_error')
        
        self.training_metrics = {
            'train_mae': mean_absolute_error(y_train, y_pred_train),
            'test_mae': mean_absolute_error(y_test, y_pred_test),
            'train_rmse': np.sqrt(mean_squared_error(y_train, y_pred_train)),
            'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test)),
            'train_r2': r2_score(y_train, y_pred_train),
            'test_r2': r2_score(y_test, y_pred_test),
            'cv_mae_mean': -cv_scores.mean(),
            'cv_mae_std': cv_scores.std(),
        }
        
        self.is_trained = True
        return self.training_metrics
    
    def train_from_synthetic(self, n_samples: int = 1000) -> Dict:
        """Train the model using synthetic data."""
        df = self.generate_synthetic_data(n_samples)
        X = df[self.FEATURE_NAMES].values
        y = df['rul_months'].values
        return self.train(X, y)
    
    def predict(self, features: Dict[str, float]) -> Dict:
        """
        Predict RUL for a single battery.
        
        Args:
            features: Dictionary with feature values
            
        Returns:
            Dictionary with prediction results
        """
        if not self.is_trained or self.model is None:
            raise ValueError("Model is not trained. Call train() first.")
        
        # Prepare feature vector
        X = np.array([[features.get(f, 0) for f in self.FEATURE_NAMES]])
        
        # Get prediction
        rul_months = self.model.predict(X)[0]
        
        # Estimate confidence based on feature values
        soh = features.get('current_soh', 80)
        confidence = self._estimate_confidence(soh, rul_months)
        
        # Generate health status
        health_status = self._get_health_status(soh, rul_months)
        
        return {
            'rul_months': max(0, round(rul_months, 1)),
            'rul_cycles': int(max(0, rul_months * 30)),  # Approx cycles per month
            'confidence': round(confidence, 2),
            'health_status': health_status,
            'current_soh': soh,
            'eol_threshold': self.EOL_THRESHOLD,
            'recommendations': self._get_recommendations(features, rul_months),
        }
    
    def predict_batch(self, features_list: List[Dict]) -> List[Dict]:
        """Predict RUL for multiple batteries."""
        return [self.predict(f) for f in features_list]
    
    def _estimate_confidence(self, soh: float, rul: float) -> float:
        """Estimate prediction confidence based on data characteristics."""
        # Higher confidence when SOH is in typical range
        soh_confidence = 1.0 if 70 <= soh <= 100 else 0.7
        
        # Higher confidence for reasonable RUL predictions
        rul_confidence = 1.0 if 0 <= rul <= 60 else 0.8
        
        return min(soh_confidence, rul_confidence) * 0.95  # Max 95% confidence
    
    def _get_health_status(self, soh: float, rul_months: float) -> str:
        """Determine battery health status category."""
        if soh >= 90 and rul_months >= 24:
            return 'Excellent'
        elif soh >= 80 and rul_months >= 12:
            return 'Good'
        elif soh >= 70 and rul_months >= 6:
            return 'Fair'
        elif soh >= 70:
            return 'Degraded'
        else:
            return 'Critical'
    
    def _get_recommendations(self, features: Dict, rul_months: float) -> List[str]:
        """Generate maintenance recommendations based on battery state."""
        recommendations = []
        
        soh = features.get('current_soh', 80)
        fast_charge_ratio = features.get('fast_charge_ratio', 0)
        avg_temp = features.get('avg_temperature', 25)
        avg_dod = features.get('avg_dod', 50)
        
        if fast_charge_ratio > 0.5:
            recommendations.append('Reduce fast charging frequency to extend battery life')
        
        if avg_temp > 35:
            recommendations.append('Consider parking in shade; high temperatures accelerate degradation')
        
        if avg_dod > 80:
            recommendations.append('Avoid deep discharges; try to keep SOC between 20-80%')
        
        if rul_months < 6:
            recommendations.append('Schedule battery inspection; replacement may be needed soon')
        
        if soh < 75:
            recommendations.append('Battery capacity significantly reduced; plan for replacement')
        
        if not recommendations:
            recommendations.append('Battery in good condition; continue normal usage patterns')
        
        return recommendations
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from the trained model."""
        if not self.is_trained or self.model is None:
            raise ValueError("Model is not trained.")
        
        # Get the regressor from pipeline
        regressor = self.model.named_steps['regressor']
        importances = regressor.feature_importances_
        
        return dict(zip(self.FEATURE_NAMES, importances.tolist()))
    
    def save(self, path: str) -> None:
        """Save the trained model to disk."""
        if not self.is_trained:
            raise ValueError("Model is not trained.")
        
        model_data = {
            'model': self.model,
            'is_trained': self.is_trained,
            'training_metrics': self.training_metrics,
            'feature_names': self.FEATURE_NAMES,
        }
        joblib.dump(model_data, path)
    
    def load(self, path: str) -> None:
        """Load a trained model from disk."""
        model_data = joblib.load(path)
        self.model = model_data['model']
        self.is_trained = model_data['is_trained']
        self.training_metrics = model_data['training_metrics']


# Singleton instance for API usage
_model_instance: Optional[EVBatteryRULModel] = None

def get_model() -> EVBatteryRULModel:
    """Get or create the singleton model instance."""
    global _model_instance
    if _model_instance is None:
        _model_instance = EVBatteryRULModel()
        # Check for pre-trained model
        model_path = Path(__file__).parent.parent / 'models' / 'ev_rul_model.joblib'
        if model_path.exists():
            _model_instance.load(str(model_path))
        else:
            # Train with synthetic data if no model exists
            _model_instance.train_from_synthetic(n_samples=2000)
    return _model_instance


if __name__ == '__main__':
    # Demo / test the model
    model = EVBatteryRULModel()
    
    print("Training model with synthetic data...")
    metrics = model.train_from_synthetic(n_samples=2000)
    
    print("\nTraining Metrics:")
    for metric, value in metrics.items():
        print(f"  {metric}: {value:.4f}")
    
    print("\nFeature Importance:")
    for feature, importance in model.get_feature_importance().items():
        print(f"  {feature}: {importance:.4f}")
    
    # Test prediction
    test_battery = {
        'current_soh': 85.0,
        'cycle_count': 500,
        'avg_temperature': 28.0,
        'fast_charge_ratio': 0.3,
        'age_months': 24,
        'avg_dod': 60.0,
        'capacity_kwh': 75,
        'ambient_temp_avg': 22,
    }
    
    print("\nTest Prediction:")
    result = model.predict(test_battery)
    for key, value in result.items():
        print(f"  {key}: {value}")
    
    # Save model
    model.save('../models/ev_rul_model.joblib')
    print("\nModel saved to models/ev_rul_model.joblib")
