export function calcCurrentSemester(enrollmentYear) {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const academicYearStart = month >= 9 ? year : year - 1;
  const yearsElapsed = academicYearStart - Number(enrollmentYear);
  const isOdd = month >= 9 || month === 1;
  const s = yearsElapsed * 2 + (isOdd ? 1 : 2);
  return Number.isFinite(s) && s >= 1 ? s : 1;
}

export function calcAcademicYear() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const start = month >= 9 ? year : year - 1;
  return `${start}-${start + 1}`;
}
