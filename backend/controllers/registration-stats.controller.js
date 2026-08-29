import registrationStatsService from "../services/registrations/registration-stats.service.js";

export async function getPendingQueue(req, res, next) {
  try {
    const result = await registrationStatsService.getPendingQueue({
      auth: req.auth,
      query: req.query,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getStatsSummary(req, res, next) {
  try {
    const result = await registrationStatsService.getStatsSummary(req.auth);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getLeaderboard(req, res, next) {
  try {
    const result = await registrationStatsService.getLeaderboard(req.auth);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getMemberStats(req, res, next) {
  try {
    const result = await registrationStatsService.getMemberStats({
      auth: req.auth,
      query: req.query,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getAuditLog(req, res, next) {
  try {
    const result = await registrationStatsService.getAuditLog({
      auth: req.auth,
      query: req.query,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  getPendingQueue,
  getStatsSummary,
  getLeaderboard,
  getMemberStats,
  getAuditLog,
};
