import { useEffect, useRef, useState } from 'react'
import { marksStatementHTML, MARKS_STATEMENT_STYLE, sgpaOf } from '../utils/generateStudentCards'
import { formatMonthYear } from '../utils/formatDate'

// The sheet is built at the width it prints at, then scaled to whatever the
// page has — larger on a desktop, smaller on a phone. Scaling, not
// re-styling: what is on screen is the university's own Statement of Marks,
// down to the last row, not a second layout that has to be kept in step
// with it.
const SHEET_WIDTH = 1000

// The student's / centre's read-only Statement of Marks, rendered IN the page.
//
// Both portals render this same component from the same portal_marksheet rows,
// so a centre and the student it belongs to never look at different numbers.
// It is always the STUDENT copy — no DMC number, no signature blocks — and it
// carries no print or download: the university issues the printed marksheet,
// and a file handed out here would look like one without being one.
export default function ResultSheetView({ student, semester, sheet, status }) {
  const box = useRef(null)
  const page = useRef(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)
  const [offset, setOffset] = useState(0)

  const html = marksStatementHTML(student || {}, sheet?.papers || [], {
    semester: `Semester ${semester}`,
    // The admin's typed "Exam. Held" label wins; the exam start month is the
    // fallback — the same order the printed sheet uses.
    examHeld: String(sheet?.exam_held || '').trim() || formatMonthYear(sheet?.exam_start),
    resultStatus: status === 'Fail' ? 'Failed' : 'Passed',
    // CGPA spans every semester up to this one, not just this one.
    cgpa: sgpaOf(sheet?.upto || []),
  })

  useEffect(() => {
    const b = box.current, p = page.current
    if (!b || !p) return
    const fit = () => {
      const s = Math.min(b.clientWidth / SHEET_WIDTH, 1)
      setScale(s)
      setHeight(p.offsetHeight * s)
      // A transform does not shrink the element's layout box, so on a wide
      // page the 1000px sheet still sits hard against the left edge with the
      // slack piled up on the right. Centre it on what it actually occupies.
      setOffset(Math.max(0, (b.clientWidth - SHEET_WIDTH * s) / 2))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    // The logo arrives after the markup and changes the sheet's height.
    const imgs = [...p.querySelectorAll('img')]
    imgs.forEach(i => i.addEventListener('load', fit))
    return () => { ro.disconnect(); imgs.forEach(i => i.removeEventListener('load', fit)) }
  }, [html])

  return (
    <div ref={box} style={{ height: height || undefined }} className="overflow-hidden student-copy">
      <style>{MARKS_STATEMENT_STYLE}</style>
      <div ref={page}
        style={{ width: SHEET_WIDTH, marginLeft: offset,
                 transform: `scale(${scale})`, transformOrigin: 'top left' }}
        dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
