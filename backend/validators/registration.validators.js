export const CLOUDINARY_UPLOAD_FOLDER = "zephyr-payments";

export function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isValidCloudinaryPublicId(value) {
  const publicId = toTrimmedString(value);
  return (
    publicId.length > CLOUDINARY_UPLOAD_FOLDER.length + 1 &&
    publicId.length <= 255 &&
    publicId.startsWith(`${CLOUDINARY_UPLOAD_FOLDER}/`) &&
    /^[A-Za-z0-9/_-]+$/.test(publicId) &&
    !publicId.includes("..") &&
    !publicId.includes("//")
  );
}

export function isValidCloudinaryImageUrl(value, publicId) {
  try {
    const url = new URL(value);
    const pathWithoutExtension = url.pathname.replace(/\.[^/.]+$/, "");

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/image/upload/") &&
      pathWithoutExtension.endsWith(`/${publicId}`)
    );
  } catch (_err) {
    return false;
  }
}

export function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export function buildDateFilter(from, to) {
  const filter = {};
  if (from) {
    const fromDate = new Date(String(from).trim());
    if (!isNaN(fromDate.getTime())) {
      filter.$gte = fromDate;
    }
  }
  if (to) {
    const toStr = String(to).trim();
    let toDate = new Date(toStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
      toDate = new Date(`${toStr}T23:59:59.999Z`);
    }
    if (!isNaN(toDate.getTime())) {
      filter.$lte = toDate;
    }
  }
  return Object.keys(filter).length > 0 ? filter : null;
}
