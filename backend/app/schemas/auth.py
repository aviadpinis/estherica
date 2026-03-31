from pydantic import BaseModel


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminIdentity(BaseModel):
    id: int
    email: str
    full_name: str | None = None


class AdminCreateRequest(BaseModel):
    email: str
    password: str
    full_name: str | None = None


class AdminResponse(BaseModel):
    id: int
    email: str
    full_name: str | None = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminIdentity
