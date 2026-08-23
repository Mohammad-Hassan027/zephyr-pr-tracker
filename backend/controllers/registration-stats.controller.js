import registrationStatsService from "../services/registrations/registration-stats.service.js";
import { AppError } from "../utils/errors.js";

export async function getPendingQueue(req, res) {
  try {
    const result = await registrationStatsService.getPendingQueue({
      auth: req.auth,
      query: req.query,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function getStatsSummary(req, res) {
  try {
    const result = await registrationStatsService.getStatsSummary(req.auth);
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function getLeaderboard(req, res) {
  try {
    const result = await registrationStatsService.getLeaderboard(req.auth);
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function getMemberStats(req, res) {
  try {
    const result = await registrationStatsService.getMemberStats({
      auth: req.auth,
      query: req.query,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function getAuditLog(req, res) {
  try {
    const result = await registrationStatsService.getAuditLog({
      auth: req.auth,
      query: req.query,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export default {
  getPendingQueue,
  getStatsSummary,
  getLeaderboard,
  getMemberStats,
  getAuditLog,
};
