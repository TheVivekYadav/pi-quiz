import http from 'k6/http';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

const s200 = new Counter('status_200');
const s401 = new Counter('status_401');
const s403 = new Counter('status_403');
const s404 = new Counter('status_404');
const s429 = new Counter('status_429');
const s5xx = new Counter('status_5xx');
const sOther = new Counter('status_other');

export const options = {
    scenarios: {
        diagnose: {
            executor: 'constant-vus',
            vus: Number(__ENV.VUS || 200),
            duration: __ENV.DURATION || '30s',
        },
    },
};

export default function () {
    const r = http.get(`${BASE_URL}/quiz/home`, {
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
        },
    });

    if (r.status === 200) s200.add(1);
    else if (r.status === 401) s401.add(1);
    else if (r.status === 403) s403.add(1);
    else if (r.status === 404) s404.add(1);
    else if (r.status === 429) s429.add(1);
    else if (r.status >= 500) s5xx.add(1);
    else sOther.add(1);
}
