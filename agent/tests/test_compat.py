"""Offline compatibility checks for the pinned voice/graph stack.

These tests make no network calls and need no API keys. They confirm that the
installed packages expose the classes and options the agent will rely on, and
that a LangGraph graph streams tokens through LiveKit's LLMAdapter.
"""

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage
from langgraph.graph import START, MessagesState, StateGraph
from livekit.agents import llm
from livekit.plugins import langchain as lk_langchain
from livekit.plugins import sarvam

DUMMY_KEY = "test-key-not-real"


def _build_graph(reply: str):
    model = GenericFakeChatModel(messages=iter([AIMessage(content=reply)]))

    async def respond(state: MessagesState):
        return {"messages": [await model.ainvoke(state["messages"])]}

    builder = StateGraph(MessagesState)
    builder.add_node("respond", respond)
    builder.add_edge(START, "respond")
    return builder.compile()


@pytest.mark.asyncio
async def test_langgraph_streams_through_livekit_adapter():
    reply = "Namaste, main aapki kya madad kar sakti hoon?"
    adapter = lk_langchain.LLMAdapter(_build_graph(reply))

    chat_ctx = llm.ChatContext.empty()
    chat_ctx.add_message(role="system", content="You are a clinic receptionist.")
    chat_ctx.add_message(role="user", content="Hello")

    chunks = []
    async with adapter.chat(chat_ctx=chat_ctx) as stream:
        async for chunk in stream:
            if chunk.delta and chunk.delta.content:
                chunks.append(chunk.delta.content)

    assert len(chunks) > 1, "expected token-by-token streaming, got one chunk"
    assert "".join(chunks) == reply


def test_adapter_rejects_unsupported_stream_mode():
    with pytest.raises(ValueError):
        lk_langchain.LLMAdapter(_build_graph("x"), stream_mode="values")


@pytest.mark.parametrize("language", ["hi-IN", "en-IN", "unknown"])
def test_sarvam_stt_accepts_demo_languages(language):
    sarvam.STT(language=language, model="saaras:v4", api_key=DUMMY_KEY)


@pytest.mark.parametrize(
    "language,speaker",
    [("hi-IN", "priya"), ("en-IN", "priya"), ("en-IN", "amelia")],
)
def test_sarvam_tts_accepts_demo_voices(language, speaker):
    sarvam.TTS(
        target_language_code=language,
        model="bulbul:v3",
        speaker=speaker,
        api_key=DUMMY_KEY,
    )


def test_sarvam_llm_model_is_supported():
    sarvam.LLM(model="sarvam-105b", api_key=DUMMY_KEY)


def test_langchain_sarvam_supports_tools_and_streaming():
    from langchain_sarvam import ChatSarvam

    chat = ChatSarvam(model="sarvam-105b", api_key=DUMMY_KEY)
    assert hasattr(chat, "bind_tools")
    assert hasattr(chat, "with_structured_output")
    assert type(chat)._astream is not ChatSarvam.__mro__[1]._astream
