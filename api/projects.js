export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ 
      error: "Vercel KV Database not connected. Please connect KV in your Vercel Project dashboard." 
    });
  }

  // Helper helper to run Redis commands via Upstash REST API
  async function runRedisCommand(commandArray) {
    const response = await fetch(KV_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commandArray)
    });
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Redis command error: ${errText}`);
    }
    
    const data = await response.json();
    return data.result;
  }

  try {
    if (req.method === 'GET') {
      const dataStr = await runRedisCommand(['GET', 'co_align_projects']);
      const projects = dataStr ? JSON.parse(dataStr) : [];
      return res.status(200).json(projects);
    } 
    
    else if (req.method === 'POST') {
      const newProject = req.body;
      if (!newProject || !newProject.title) {
        return res.status(400).json({ error: "Missing project payload or title" });
      }

      const dataStr = await runRedisCommand(['GET', 'co_align_projects']);
      let projects = dataStr ? JSON.parse(dataStr) : [];

      // Check if project with same title already exists
      const existIdx = projects.findIndex(p => p.title.toLowerCase() === newProject.title.toLowerCase());
      if (existIdx !== -1) {
        projects[existIdx] = newProject;
      } else {
        projects.push(newProject);
      }

      await runRedisCommand(['SET', 'co_align_projects', JSON.stringify(projects)]);
      return res.status(200).json({ success: true, projects });
    } 
    
    else if (req.method === 'DELETE') {
      const { title } = req.query;
      if (!title) {
        return res.status(400).json({ error: "Missing project title query parameter" });
      }

      const dataStr = await runRedisCommand(['GET', 'co_align_projects']);
      let projects = dataStr ? JSON.parse(dataStr) : [];

      projects = projects.filter(p => p.title.toLowerCase() !== title.toLowerCase());

      await runRedisCommand(['SET', 'co_align_projects', JSON.stringify(projects)]);
      return res.status(200).json({ success: true, projects });
    } 
    
    else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Vercel KV Serverless function error:", error);
    return res.status(500).json({ error: error.message });
  }
}
