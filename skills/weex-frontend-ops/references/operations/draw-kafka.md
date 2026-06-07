# Frontend Draw Kafka Callback Validation

Status: candidate  
Last verified: 2026-05-13  
Environment: staging `https://stg-www.weex.tech` plus internal Kafka UI  
Viewport: desktop `1440x1000`

Use only for internal STG task-callback validation after the frontend account has joined or is eligible for the draw activity. This does not replace real frontend trading or recharge UI behavior unless the user explicitly asks to validate the callback path.

## Required Inputs

- Activity alias and expected activity ID.
- Account email and UID.
- Target task ID and task type, for example `RECHARGE`.
- Kafka callback value payload. The callback record `after.id` must be unique per send.
- Browser mode requirement (`--visible` for visible execution).

## Script

- `scripts/frontend-draw-kafka-recharge-verify.mjs`
- Cached action: `frontend_draw_kafka_recharge_verify`

## Kafka UI

`http://10.5.53.28:8080/ui/clusters/new-stg-kafka/all-topics/flink.exchange.spot_capital_order_info/messages?keySerde=String&valueSerde=String&limit=100`

When sending from Kafka UI, fill only `Value`. Do not fill key or headers unless the user explicitly asks.

- Current stable path uses the ACE editor instance in the produce modal:
  click `Produce Message` to open modal -> write payload into the second visible ACE editor (Value) -> click modal `Produce Message`.
- If direct textarea fill fails, do not stop at `textarea` selectors; fallback to ACE editor write.

## Steps

1. Create or select a frontend STG test account and build the frontend auth cookie with `loginTool`.
2. Open `https://stg-www.weex.tech/zh-CN/events/draw/<activity-alias>` in visible browser mode when requested.
3. Complete signup if the activity requires it; verify `applyStatus=true` before sending the callback.
4. Open Kafka UI and produce one message to `flink.exchange.spot_capital_order_info`; fill only `Value`.
5. Return to the draw page with the same account login state and poll task evidence.
6. If `loginTool` returns transient `20105 Operation failed. Try again.`, retry login-state creation before declaring the task failed.
7. If direct page-context fetch to activity APIs returns non-JSON shell content, rely on real page network responses (`applyStatus`, `taskCompletions`, `raffle/frequency`) for verification.

## Success Assertions

- Kafka UI produce returns HTTP 200 and topic offset increases.
- `GET /v1/activity/general/applyStatus?identifier=<alias>&languageType=1` returns `data=true` when signup applies.
- `GET /v1/activity/general/taskCompletions?identifier=<alias>&languageType=1` contains the expected `taskId` or `type` with `status=COMPLETED` or task-specific achieved fields.
- `GET /v1/activity/general/raffle/frequency` returns `doTaskGetCount > 0`.
- The visible task card reflects the task progress after refresh or API polling.

## Verified 2026-05-13 Sample

- Activity ID `9099`, alias `zp3t0d`, task ID `4991`, task type `RECHARGE`.
- Account `codexapi1778683806339@weex.com` / UID `9224904392`.
- Kafka value used unique business ID `1778683988`, `coin_id=2`, `amount=200`, `biz_type=1`, `biz_sub_type=1`, `status=9`.
- Kafka produce returned HTTP 200 and partition 0 offset increased from `4780` to `4781`.
- Completion proof: `taskId=4991`, `type=RECHARGE`, `status=COMPLETED`, `netRechargeAmount=200`, `totalRechargeAmount=200`, `netRechargeAchieveTime=1778684003076`, `doTaskGetCount=1`.

## Verified 2026-05-13 Sample (New Activity)

- Activity ID `9101`, alias `zp0513171053`, task ID `4991`, task type `RECHARGE`.
- Account `codexapi1778685384170@weex.com` / UID `3083326425`.
- Kafka produce API `POST /api/clusters/new-stg-kafka/topics/flink.exchange.spot_capital_order_info/messages` returned HTTP 200.
- Completion proof: `taskId=4991`, `status=COMPLETED`, `netRechargeAmount=200`, `totalRechargeAmount=200`, `doTaskGetCount=1`, final page `https://stg-www.weex.tech/zh-CN/events/draw/zp0513171053`.
