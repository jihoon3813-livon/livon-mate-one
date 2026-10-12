module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return res.status(200).json({
    success: true,
    data: {
      totalTargets: 0,
      submittedCount: 0,
      responseRate: 0,
      urgentFollowups: 0,
      unguidedCount: 0,
      guidanceRate: 0,
      avgScore: '0.0',
      responseCount: 0,
      pendingRewardPoints: 0
    }
  });
};
