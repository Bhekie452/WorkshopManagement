from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class VoiceCommand(Base):
    __tablename__ = 'voice_commands'
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    command_text = Column(Text, nullable=False)
    response_text = Column(Text, nullable=True)
    success = Column(Boolean, nullable=False, default=True)
    context = Column(String(100), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
