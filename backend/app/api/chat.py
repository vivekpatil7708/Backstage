from fastapi import APIRouter
from pydantic import BaseModel

from ..services.chatbot import strategy_coach

router = APIRouter()


class ChatMessage(BaseModel):
    message: str
    history: list[dict] = []


@router.post("/chat", summary="Chat with strategy coach")
async def chat(msg: ChatMessage):
    history = [{"role": h["role"], "content": h["content"]} for h in msg.history]
    response = await strategy_coach.chat(msg.message, history)
    return {"response": response}
