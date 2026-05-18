#!/usr/bin/env python3
"""
Script to clean up users with AUDITOR role from the database.
This script will delete all users with the AUDITOR role since it's no longer supported.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import select, delete
from app.db.session import SessionLocal
from app.domain.models import User

def cleanup_auditor_users():
    """Remove all users with AUDITOR role from the database."""
    db = SessionLocal()
    try:
        # Find all users with AUDITOR role
        auditor_users = db.scalars(
            select(User).where(User.role == 'AUDITOR')
        ).all()
        
        print(f"Found {len(auditor_users)} users with AUDITOR role:")
        for user in auditor_users:
            print(f"  - {user.username} (ID: {user.id})")
        
        if auditor_users:
            # Delete all users with AUDITOR role
            delete_stmt = delete(User).where(User.role == 'AUDITOR')
            result = db.execute(delete_stmt)
            db.commit()
            print(f"Deleted {result.rowcount} users with AUDITOR role")
        else:
            print("No users with AUDITOR role found")
            
    except Exception as e:
        print(f"Error cleaning up auditor users: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_auditor_users()
    print("Cleanup completed successfully!")