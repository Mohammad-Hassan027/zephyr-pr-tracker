import registrationExportService from "../services/registrations/registration-export.service.js";

/**
 * Controller for streaming registration data exports.
 */
export async function exportRegistrations(req, res, next) {
  try {
    const exportType = String(req.query.type || "all").trim().toLowerCase();
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `zephyr-export-${exportType}-${dateStr}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    if (exportType === "referral_performance") {
      return await registrationExportService.streamReferralPerformanceCsv({
        auth: req.auth,
        query: req.query,
        res,
      });
    }

    if (exportType === "payment_reconciliation") {
      return await registrationExportService.streamPaymentReconciliationCsv({
        auth: req.auth,
        query: req.query,
        res,
      });
    }

    return await registrationExportService.streamRegistrationsCsv({
      auth: req.auth,
      query: req.query,
      res,
      exportType,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  exportRegistrations,
};
