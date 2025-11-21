# AVIO Backend — Demo API map

Base URL (local): http://localhost:5000

## AI Parsing
POST /ai/parse
Body: { "instruction": "Send John ₦2k every Monday at 8PM" }
Response: { success: true, parsedRule: {...} }

## Rule management
POST /rules
Body: { "text": "Every Friday send ₦5000 to Bolu" }
Response: created rule + preview

GET /rules
GET /rules/:id
PUT /rules/:id
DELETE /rules/:id

## Preview (do not save)
POST /rules/preview
Body: { "text": "Send 10k if AVAX < $30" }
Response: parsed + preview

## Run a rule immediately (for demo)
POST /actions/run
Body: { "ruleId": "<id>" }
Response: simulated execution receipt

## Status
GET /rules/:id/status

## Example curl
curl -X POST http://localhost:5000/ai/parse -H "Content-Type: application/json" -d '{"instruction":"Send John ₦2k every Monday at 8PM"}'

curl -X POST http://localhost:5000/rules -H "Content-Type: application/json" -d '{"text":"Every Friday send ₦5000 to Bolu"}'

curl -X POST http://localhost:5000/actions/run -H "Content-Type: application/json" -d '{"ruleId":"<ruleId>"}'
