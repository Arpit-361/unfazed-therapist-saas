// All monetary values are stored as integer paise.
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => Math.round(Number(paise || 0)) / 100;

const formatInr = (paise) =>
  `INR ${toRupees(paise).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

module.exports = { toPaise, toRupees, formatInr };
