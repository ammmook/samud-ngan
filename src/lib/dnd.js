/* ตัวจัดการ dragover/dragleave ของช่องที่วางได้ ใช้ร่วมกันทั้งมุมมองเดือนและแนวเวลา */
export function dropZoneProps(date, dropDate, setDropDate) {
  return {
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropDate !== date) setDropDate(date);
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget) && dropDate === date) setDropDate(null);
    },
  };
}
