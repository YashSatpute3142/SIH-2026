import asyncio
import websockets


async def listen():
    uri = "ws://localhost:8000/ws/readings"
    async with websockets.connect(uri) as websocket:
        print("connected, waiting for broadcasts (press Ctrl+C to stop)...")
        try:
            while True:
                message = await websocket.recv()
                print("received:", message)
        except websockets.exceptions.ConnectionClosed:
            print("connection closed")


if __name__ == "__main__":
    asyncio.run(listen())
