from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import requests
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    TECHNICIAN = "technician"
    CLIENT = "client"

class WorkOrderStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    APPROVED = "approved"
    CANCELLED = "cancelled"

class SLAType(str, Enum):
    NORMAL = "normal"
    URGENT = "urgent"
    CRITICAL = "critical"

class RequestType(str, Enum):
    MEP = "MEP"
    CIVIL = "Civil"
    PLUMBING = "Plumbing"
    ELECTRICAL = "Electrical"
    HVAC = "HVAC"
    OTHER = "Other"

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: UserRole
    password_hash: Optional[str] = None
    picture: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = UserRole.CLIENT

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class SessionData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WorkOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    request_id: str
    title: str
    description: str
    status: WorkOrderStatus = WorkOrderStatus.PENDING
    request_type: RequestType
    sla_type: SLAType = SLAType.NORMAL
    location: str
    department: Optional[str] = None
    client_id: str
    client_name: str
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    completed_at: Optional[str] = None
    duration_days: Optional[int] = None
    is_delayed: bool = False
    total_cost: float = 0.0
    created_by_id: str
    created_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class WorkOrderCreate(BaseModel):
    title: str
    description: str
    request_type: RequestType
    sla_type: SLAType = SLAType.NORMAL
    location: str
    department: Optional[str] = None
    client_id: str
    assigned_to_id: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    duration_days: Optional[int] = None

class WorkOrderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[WorkOrderStatus] = None
    request_type: Optional[RequestType] = None
    sla_type: Optional[SLAType] = None
    location: Optional[str] = None
    department: Optional[str] = None
    assigned_to_id: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    completed_at: Optional[str] = None
    duration_days: Optional[int] = None
    total_cost: Optional[float] = None

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    work_order_id: str
    user_id: str
    user_name: str
    user_role: UserRole
    content: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CommentCreate(BaseModel):
    work_order_id: str
    content: str

class CostEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    work_order_id: str
    description: str
    cost_type: str  # "material" or "labor"
    amount: float
    created_by_id: str
    created_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CostEntryCreate(BaseModel):
    work_order_id: str
    description: str
    cost_type: str
    amount: float

class PreventiveMaintenance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    location: str
    frequency: str  # "daily", "weekly", "monthly", "yearly"
    next_due_date: str
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PreventiveMaintenanceCreate(BaseModel):
    title: str
    description: str
    location: str
    frequency: str
    next_due_date: str
    assigned_to_id: Optional[str] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str
    message: str
    link: Optional[str] = None
    is_read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CompanySettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "company_settings"
    company_name: str = "My Company"
    logo_url: Optional[str] = None
    primary_color: str = "#3b82f6"
    secondary_color: str = "#10b981"
    timezone: str = "UTC"
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CompanySettingsUpdate(BaseModel):
    company_name: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    timezone: Optional[str] = None

# Helper Functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(request: Request) -> User:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    if session_token:
        # Check session in database
        session = await db.sessions.find_one({"session_token": session_token})
        if session:
            expires_at = datetime.fromisoformat(session['expires_at'])
            if expires_at > datetime.now(timezone.utc):
                user_data = await db.users.find_one({"id": session['user_id']}, {"_id": 0})
                if user_data and user_data.get('is_active'):
                    return User(**user_data)
    
    # Check Authorization header as fallback
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = decode_token(token)
        user_data = await db.users.find_one({"id": payload.get("user_id")}, {"_id": 0})
        if user_data and user_data.get('is_active'):
            return User(**user_data)
    
    raise HTTPException(status_code=401, detail="Not authenticated")

def require_role(allowed_roles: List[UserRole]):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

async def create_notification(user_id: str, title: str, message: str, link: Optional[str] = None):
    notif = Notification(user_id=user_id, title=title, message=message, link=link)
    await db.notifications.insert_one(notif.model_dump())

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        password_hash=hash_password(user_data.password)
    )
    await db.users.insert_one(user.model_dump())
    
    # Create token
    token = create_access_token({"user_id": user.id, "email": user.email})
    
    return {
        "token": token,
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user_data = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_data or not user_data.get('password_hash'):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_data['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user_data.get('is_active', True):
        raise HTTPException(status_code=401, detail="Account is inactive")
    
    token = create_access_token({"user_id": user_data['id'], "email": user_data['email']})
    
    return {
        "token": token,
        "user": {
            "id": user_data['id'],
            "email": user_data['email'],
            "name": user_data['name'],
            "role": user_data['role'],
            "picture": user_data.get('picture')
        }
    }

@api_router.post("/auth/google/session")
async def process_google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Get session data from Emergent
    try:
        resp = requests.post(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        resp.raise_for_status()
        session_data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to validate session: {str(e)}")
    
    email = session_data.get("email")
    name = session_data.get("name")
    picture = session_data.get("picture")
    emergent_session_token = session_data.get("session_token")
    
    # Find or create user
    user_data = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_data:
        # Create new user with CLIENT role by default
        user = User(
            email=email,
            name=name,
            role=UserRole.CLIENT,
            picture=picture
        )
        await db.users.insert_one(user.model_dump())
        user_id = user.id
    else:
        user_id = user_data['id']
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = SessionData(
        user_id=user_id,
        session_token=emergent_session_token,
        expires_at=expires_at.isoformat()
    )
    await db.sessions.insert_one(session.model_dump())
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=emergent_session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    
    # Get updated user data
    user_data = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    return {
        "user": {
            "id": user_data['id'],
            "email": user_data['email'],
            "name": user_data['name'],
            "role": user_data['role'],
            "picture": user_data.get('picture')
        }
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "picture": current_user.picture
    }

# Work Order Routes
@api_router.get("/work-orders", response_model=List[WorkOrder])
async def get_work_orders(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == UserRole.CLIENT:
        query["client_id"] = current_user.id
    elif current_user.role == UserRole.TECHNICIAN:
        query["assigned_to_id"] = current_user.id
    
    work_orders = await db.work_orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return work_orders

@api_router.get("/work-orders/{work_order_id}", response_model=WorkOrder)
async def get_work_order(work_order_id: str, current_user: User = Depends(get_current_user)):
    work_order = await db.work_orders.find_one({"id": work_order_id}, {"_id": 0})
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    # Check permissions
    if current_user.role == UserRole.CLIENT and work_order['client_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.TECHNICIAN and work_order['assigned_to_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return work_order

@api_router.post("/work-orders", response_model=WorkOrder)
async def create_work_order(
    wo_data: WorkOrderCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPERVISOR]))
):
    # Generate request ID
    count = await db.work_orders.count_documents({})
    request_id = f"WO-{count + 1:05d}"
    
    # Get client info
    client = await db.users.find_one({"id": wo_data.client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get assigned technician info
    assigned_to_name = None
    if wo_data.assigned_to_id:
        tech = await db.users.find_one({"id": wo_data.assigned_to_id}, {"_id": 0})
        if tech:
            assigned_to_name = tech['name']
    
    work_order = WorkOrder(
        request_id=request_id,
        title=wo_data.title,
        description=wo_data.description,
        request_type=wo_data.request_type,
        sla_type=wo_data.sla_type,
        location=wo_data.location,
        department=wo_data.department,
        client_id=wo_data.client_id,
        client_name=client['name'],
        assigned_to_id=wo_data.assigned_to_id,
        assigned_to_name=assigned_to_name,
        start_date=wo_data.start_date,
        due_date=wo_data.due_date,
        duration_days=wo_data.duration_days,
        created_by_id=current_user.id,
        created_by_name=current_user.name
    )
    
    await db.work_orders.insert_one(work_order.model_dump())
    
    # Create notifications
    await create_notification(
        wo_data.client_id,
        "New Work Order",
        f"Work order {request_id} has been created",
        f"/work-orders/{work_order.id}"
    )
    
    if wo_data.assigned_to_id:
        await create_notification(
            wo_data.assigned_to_id,
            "New Assignment",
            f"You have been assigned to work order {request_id}",
            f"/work-orders/{work_order.id}"
        )
    
    return work_order

@api_router.patch("/work-orders/{work_order_id}", response_model=WorkOrder)
async def update_work_order(
    work_order_id: str,
    updates: WorkOrderUpdate,
    current_user: User = Depends(get_current_user)
):
    work_order = await db.work_orders.find_one({"id": work_order_id}, {"_id": 0})
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    # Check permissions
    if current_user.role == UserRole.CLIENT:
        raise HTTPException(status_code=403, detail="Clients cannot update work orders")
    if current_user.role == UserRole.TECHNICIAN and work_order['assigned_to_id'] != current_user.id:
        raise HTTPException(status_code=403, detail="You can only update your assigned work orders")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    # Update assigned technician name if changed
    if 'assigned_to_id' in update_data and update_data['assigned_to_id']:
        tech = await db.users.find_one({"id": update_data['assigned_to_id']}, {"_id": 0})
        if tech:
            update_data['assigned_to_name'] = tech['name']
            # Notify new assignee
            await create_notification(
                update_data['assigned_to_id'],
                "New Assignment",
                f"You have been assigned to work order {work_order['request_id']}",
                f"/work-orders/{work_order_id}"
            )
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.work_orders.update_one({"id": work_order_id}, {"$set": update_data})
    
    # Notify client of status change
    if 'status' in update_data:
        await create_notification(
            work_order['client_id'],
            "Work Order Updated",
            f"Work order {work_order['request_id']} status changed to {update_data['status']}",
            f"/work-orders/{work_order_id}"
        )
    
    updated_work_order = await db.work_orders.find_one({"id": work_order_id}, {"_id": 0})
    return updated_work_order

@api_router.delete("/work-orders/{work_order_id}")
async def delete_work_order(
    work_order_id: str,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPERVISOR]))
):
    result = await db.work_orders.delete_one({"id": work_order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Work order not found")
    return {"message": "Work order deleted successfully"}

# Comments Routes
@api_router.get("/work-orders/{work_order_id}/comments", response_model=List[Comment])
async def get_comments(work_order_id: str, current_user: User = Depends(get_current_user)):
    comments = await db.comments.find({"work_order_id": work_order_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return comments

@api_router.post("/work-orders/{work_order_id}/comments", response_model=Comment)
async def create_comment(
    work_order_id: str,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user)
):
    # Verify work order exists
    work_order = await db.work_orders.find_one({"id": work_order_id}, {"_id": 0})
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    comment = Comment(
        work_order_id=work_order_id,
        user_id=current_user.id,
        user_name=current_user.name,
        user_role=current_user.role,
        content=comment_data.content
    )
    
    await db.comments.insert_one(comment.model_dump())
    return comment

# Cost Entries Routes
@api_router.get("/work-orders/{work_order_id}/costs", response_model=List[CostEntry])
async def get_cost_entries(work_order_id: str, current_user: User = Depends(get_current_user)):
    costs = await db.cost_entries.find({"work_order_id": work_order_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return costs

@api_router.post("/work-orders/{work_order_id}/costs", response_model=CostEntry)
async def create_cost_entry(
    work_order_id: str,
    cost_data: CostEntryCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.TECHNICIAN]))
):
    work_order = await db.work_orders.find_one({"id": work_order_id}, {"_id": 0})
    if not work_order:
        raise HTTPException(status_code=404, detail="Work order not found")
    
    cost_entry = CostEntry(
        work_order_id=work_order_id,
        description=cost_data.description,
        cost_type=cost_data.cost_type,
        amount=cost_data.amount,
        created_by_id=current_user.id,
        created_by_name=current_user.name
    )
    
    await db.cost_entries.insert_one(cost_entry.model_dump())
    
    # Update total cost on work order
    all_costs = await db.cost_entries.find({"work_order_id": work_order_id}, {"_id": 0}).to_list(1000)
    total_cost = sum(c['amount'] for c in all_costs)
    await db.work_orders.update_one(
        {"id": work_order_id},
        {"$set": {"total_cost": total_cost, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return cost_entry

# Preventive Maintenance Routes
@api_router.get("/preventive-maintenance", response_model=List[PreventiveMaintenance])
async def get_preventive_maintenance(
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPERVISOR]))
):
    pms = await db.preventive_maintenance.find({}, {"_id": 0}).sort("next_due_date", 1).to_list(1000)
    return pms

@api_router.post("/preventive-maintenance", response_model=PreventiveMaintenance)
async def create_preventive_maintenance(
    pm_data: PreventiveMaintenanceCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPERVISOR]))
):
    assigned_to_name = None
    if pm_data.assigned_to_id:
        tech = await db.users.find_one({"id": pm_data.assigned_to_id}, {"_id": 0})
        if tech:
            assigned_to_name = tech['name']
    
    pm = PreventiveMaintenance(
        title=pm_data.title,
        description=pm_data.description,
        location=pm_data.location,
        frequency=pm_data.frequency,
        next_due_date=pm_data.next_due_date,
        assigned_to_id=pm_data.assigned_to_id,
        assigned_to_name=assigned_to_name
    )
    
    await db.preventive_maintenance.insert_one(pm.model_dump())
    
    if pm_data.assigned_to_id:
        await create_notification(
            pm_data.assigned_to_id,
            "New Preventive Maintenance Task",
            f"You have been assigned to: {pm_data.title}",
            f"/preventive-maintenance"
        )
    
    return pm

# User Management Routes
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPERVISOR]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

@api_router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    updates: Dict[str, Any],
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    # Don't allow password updates through this endpoint
    if 'password' in updates or 'password_hash' in updates:
        raise HTTPException(status_code=400, detail="Use password reset endpoint")
    
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated successfully"}

@api_router.delete("/users/{user_id}")
async def deactivate_user(
    user_id: str,
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deactivated successfully"}

# Notifications Routes
@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return notifications

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"is_read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.post("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user.id},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

# Company Settings Routes
@api_router.get("/settings", response_model=CompanySettings)
async def get_settings(current_user: User = Depends(get_current_user)):
    settings = await db.company_settings.find_one({"id": "company_settings"}, {"_id": 0})
    if not settings:
        # Create default settings
        default_settings = CompanySettings()
        await db.company_settings.insert_one(default_settings.model_dump())
        return default_settings
    return settings

@api_router.patch("/settings")
async def update_settings(
    updates: CompanySettingsUpdate,
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.company_settings.update_one(
        {"id": "company_settings"},
        {"$set": update_data},
        upsert=True
    )
    return {"message": "Settings updated successfully"}

# Dashboard Stats Routes
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == UserRole.CLIENT:
        query["client_id"] = current_user.id
    elif current_user.role == UserRole.TECHNICIAN:
        query["assigned_to_id"] = current_user.id
    
    total_orders = await db.work_orders.count_documents(query)
    pending = await db.work_orders.count_documents({**query, "status": WorkOrderStatus.PENDING})
    in_progress = await db.work_orders.count_documents({**query, "status": WorkOrderStatus.IN_PROGRESS})
    completed = await db.work_orders.count_documents({**query, "status": WorkOrderStatus.COMPLETED})
    approved = await db.work_orders.count_documents({**query, "status": WorkOrderStatus.APPROVED})
    
    # Calculate total costs
    work_orders = await db.work_orders.find(query, {"_id": 0, "total_cost": 1}).to_list(1000)
    total_cost = sum(wo.get('total_cost', 0) for wo in work_orders)
    
    completion_rate = (completed + approved) / total_orders * 100 if total_orders > 0 else 0
    
    return {
        "total_orders": total_orders,
        "pending": pending,
        "in_progress": in_progress,
        "completed": completed,
        "approved": approved,
        "total_cost": total_cost,
        "completion_rate": round(completion_rate, 2)
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()