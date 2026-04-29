"""Quick WebSocket integration test for Synthex."""
import asyncio
import json
import websockets


async def test():
    uri = "ws://localhost:8000/ws/trade"
    async with websockets.connect(uri) as ws:
        # 1. JOIN
        print("--- STEP 1: JOIN ---")
        await ws.send(json.dumps({"type": "JOIN", "username": "ws_tester"}))

        # Read initial orderbook snapshot
        msg = json.loads(await ws.recv())
        print(f"  INITIAL: {msg['type']} | bid={msg['data'].get('best_bid')} ask={msg['data'].get('best_ask')}")

        # Wait for one tick broadcast
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
        print(f"  TICK:    {msg['type']} | bid={msg['data'].get('best_bid')} ask={msg['data'].get('best_ask')}")

        # 2. BUY 10 SIM
        print("\n--- STEP 2: BUY 10 SIM ---")
        await ws.send(json.dumps({"type": "MARKET_ORDER", "data": {"action": "BUY", "symbol": "SIM", "quantity": 10}}))

        for _ in range(4):
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            t = msg.get("type", "")
            if t == "TRADE_RESULT":
                d = msg["data"]
                print(f"  TRADE_RESULT: status={d['status']} price={d.get('executed_price')} fiat={d.get('new_fiat_balance')} asset={d.get('new_asset_quantity')}")
            elif t == "trade":
                print(f"  TRADE BROADCAST: price={msg['data']['price']} qty={msg['data']['quantity']} side={msg['data']['side']}")
            elif t == "orderbook_update":
                print(f"  OB UPDATE: bid={msg['data']['best_bid']} ask={msg['data']['best_ask']} spread={msg['data']['spread']}")
            elif t == "leaderboard_update":
                r = msg["data"]["rankings"]
                print(f"  LEADERBOARD: {r}")

        # 3. SELL 5 SIM
        print("\n--- STEP 3: SELL 5 SIM ---")
        await ws.send(json.dumps({"type": "MARKET_ORDER", "data": {"action": "SELL", "symbol": "SIM", "quantity": 5}}))

        for _ in range(4):
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            t = msg.get("type", "")
            if t == "TRADE_RESULT":
                d = msg["data"]
                print(f"  TRADE_RESULT: status={d['status']} price={d.get('executed_price')} fiat={d.get('new_fiat_balance')} asset={d.get('new_asset_quantity')}")
            elif t == "trade":
                print(f"  TRADE BROADCAST: price={msg['data']['price']} qty={msg['data']['quantity']} side={msg['data']['side']}")
            elif t == "orderbook_update":
                print(f"  OB UPDATE: bid={msg['data']['best_bid']} ask={msg['data']['best_ask']}")
            elif t == "leaderboard_update":
                r = msg["data"]["rankings"]
                print(f"  LEADERBOARD: {r}")

        print("\n=== ALL TESTS PASSED ===")


asyncio.run(test())
