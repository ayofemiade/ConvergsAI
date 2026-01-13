import os
from typing import List, Dict, Any, Optional
from cerebras.cloud.sdk import AsyncCerebras
from app.config import settings
from app.logger_config import logger
from app.utils.timing import timeit

class CerebrasService:
    def __init__(self):
        self.client = AsyncCerebras(api_key=settings.CEREBRAS_API_KEY)
        self.model = "llama3.3-70b"

    @timeit
    async def chat_completion(
        self, 
        messages: List[Dict[str, str]], 
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> str:
        try:
            response = await self.client.chat.completions.create(
                messages=messages,
                model=self.model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Cerebras API error: {e}")
            raise e

    async def stream_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ):
        """Streams content from Cerebras."""
        try:
            stream = await self.client.chat.completions.create(
                messages=messages,
                model=self.model,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            async for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            logger.error(f"Cerebras Stream error: {e}")
            raise e

cerebras_service = CerebrasService()
