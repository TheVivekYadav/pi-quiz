import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export const options = {
    scenarios: {
        ramp: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: __ENV.STAGE1_UP || '20s', target: Number(__ENV.STAGE1_VUS || 100) },
                { duration: __ENV.STAGE1_HOLD || '30s', target: Number(__ENV.STAGE1_VUS || 100) },
                { duration: __ENV.STAGE2_UP || '20s', target: Number(__ENV.STAGE2_VUS || 200) },
                { duration: __ENV.STAGE2_HOLD || '30s', target: Number(__ENV.STAGE2_VUS || 200) },
                { duration: __ENV.STAGE3_UP || '20s', target: Number(__ENV.STAGE3_VUS || 400) },
                { duration: __ENV.STAGE3_HOLD || '30s', target: Number(__ENV.STAGE3_VUS || 400) },
                { duration: __ENV.RAMP_DOWN || '20s', target: 0 },
            ],
            gracefulRampDown: '5s',
        },
    },
    thresholds: {
        http_req_failed: [`rate<${__ENV.MAX_ERROR_RATE || '0.02'}`],
        http_req_duration: [`p(95)<${__ENV.P95_MS || '1200'}`],
    },
};

export default function () {
    const res = http.get(`${BASE_URL}/quiz/home`, {
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    check(res, {
        'status 200': (r) => r.status === 200,
    });

    sleep(Number(__ENV.SLEEP_S || '0.3'));
}
