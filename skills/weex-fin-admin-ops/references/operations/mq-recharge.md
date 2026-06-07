# MQ Recharge Callback

## Scope

- Use this playbook when the user explicitly wants to simulate a recharge callback by UID and amount, for example `帮我 uid 充值1000`.
- This is not a FIN Admin page flow. It uses the verified Kafka UI page for topic `flink.exchange.spot_capital_order_info`.
- Primary use case: support frontend activity recharge-task testing after the target user has already signed up for the activity.

## Verified Inputs

- Required:
  - `uid`
  - `amount`
- Optional:
  - `messageId`
  - `kafkaUrl`
- Verified default payload fields:
  - `coin_id = 2`
  - `biz_type = 1`
  - `biz_sub_type = 1`
  - `status = 9`

## Verified Page

- Kafka UI page:
  - `http://10.5.53.28:8080/ui/clusters/new-stg-kafka/all-topics/flink.exchange.spot_capital_order_info/messages?keySerde=String&valueSerde=String&limit=100`
- Verified editor ids:
  - Key editor: `key`
  - Value editor: `content`
  - Headers editor: `headers`

## Verified Execution Rule

1. Open the Kafka UI topic messages page.
2. Write empty key into Ace editor `key`.
3. Write the JSON payload into Ace editor `content`.
4. Write `{}` into Ace editor `headers`.
5. Click the form `Produce Message` button.
6. Verify all three signals:
   - `POST /api/clusters/new-stg-kafka/topics/flink.exchange.spot_capital_order_info/messages` returns HTTP `200`
   - page shows `Success` and `Message successfully sent`
   - reloading the page can find the generated `messageId` in the message list

## Verified Payload Shape

```json
{
  "after": {
    "id": 79196498362,
    "user_id": 5139967417,
    "coin_id": 2,
    "amount": "1000",
    "biz_type": 1,
    "biz_sub_type": 1,
    "status": 9
  }
}
```

## Proven Evidence

- Real run date: `2026-05-19`
- Verified run:
  - `uid = 5139967417`
  - `amount = 1000`
  - generated `messageId = 79196498362`
- Success evidence:
  - Kafka produce API HTTP `200`
  - UI success text visible
  - message list reload contained the same `messageId`

## Script

- Entry:
  - `scripts/mq-recharge-callback-send.mjs`
- Dry run:
```bash
node skills/weex-fin-admin-ops/scripts/mq-recharge-callback-send.mjs --dry-run --uid <UID> --amount <AMOUNT>
```
- Real run:
```bash
node skills/weex-fin-admin-ops/scripts/mq-recharge-callback-send.mjs --uid <UID> --amount <AMOUNT> --confirm-send
```

## Cache Routing

- Cached action id: `mq_recharge_callback_send`
- Natural language should match when the request clearly contains `uid` plus `充值` or `MQ/Kafka`.

## Limits

- Do not treat a null-content Kafka request as success.
- This flow only verifies message production into Kafka UI and topic-list visibility. Whether the downstream business task is consumed successfully still depends on the downstream service and should be verified separately when needed.
