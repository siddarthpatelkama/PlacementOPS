import fetch from 'node-fetch';

async function getLogs() {
  const query = '{app="placement-ops-demab"}';
  const url = `https://metrics.miget.com/loki/api/v1/query_range?query=${encodeURIComponent(query)}&limit=50`;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer miget_live_041328ff8289cf5f465a1dde0f8fc302a2efa85f7ee8fb43097e4b54ccb64ae4'
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

getLogs();
