import os
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from database import get_db
from models import User, UserSettings

import bcrypt

# ─── Password Hashing ───────────────────────────────────────────────

def hash_password(password: str) -> str:
    # bcrypt requires bytes
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


# ─── JWT Token Management ───────────────────────────────────────────

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def _get_secret_key() -> str:
    """Load or generate a persistent JWT secret key stored in AppData."""
    app_data = os.environ.get('LOCALAPPDATA')
    if app_data:
        secret_dir = os.path.join(app_data, 'FocusPie')
    else:
        secret_dir = os.path.join(os.path.expanduser('~'), '.focuspie')
    os.makedirs(secret_dir, exist_ok=True)
    secret_path = os.path.join(secret_dir, '.jwt_secret')

    if os.path.exists(secret_path):
        with open(secret_path, 'r') as f:
            return f.read().strip()
    else:
        secret = os.urandom(32).hex()
        with open(secret_path, 'w') as f:
            f.write(secret)
        return secret

SECRET_KEY = _get_secret_key()

security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency that extracts and validates the JWT, returning the User object."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError as e:
        print("JWTError raised:", str(e))
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Like get_current_user but returns None instead of raising if no/invalid token."""
    if credentials is None:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return db.query(User).filter(User.id == int(user_id)).first()
    except JWTError:
        return None
