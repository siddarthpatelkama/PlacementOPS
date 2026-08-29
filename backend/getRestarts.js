import fetch from 'node-fetch';

async function getMetrics() {
  const query = 'miget_instance_restarts_total{app="placement-ops-demab"}';
  const url = `https://metrics.miget.com/prometheus/api/v1/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer miget_live_041328ff8289cf5f465a1dde0f8fc302a2efa85f7ee8fb43097e4b54ccb64ae4'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

getMetrics();
