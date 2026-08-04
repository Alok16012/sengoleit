import { FileSpreadsheet, FileText } from 'lucide-react'
import Button from './ui/Button'
import { exportCsv, exportPdf } from '../utils/exportTable'

// The Excel / PDF pair that sits beside a report table.
//
// Pass the rows EXACTLY as the table renders them — already searched, filtered
// and tab-scoped — so the export can never disagree with what is on screen.
// `meta` lines describe the filters that were in force and are printed on the
// PDF under the heading.
//
// columns: [{ header, value: row => string, pdfValue?: row => string }]
// `value` is what Excel gets (leave money as a bare number so a column can be
// summed); `pdfValue`, where given, is what the printed sheet shows instead.
export default function ExportButtons({ title, filename, columns, rows, meta = [], className = '' }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      <Button variant="secondary" size="md" title={`Export ${title} to Excel`}
        onClick={() => exportCsv(filename, columns, rows || [])}>
        <FileSpreadsheet size={14} /> Excel
      </Button>
      <Button variant="secondary" size="md" title={`Print ${title} as PDF`}
        onClick={() => exportPdf(title, columns, rows || [], meta)}>
        <FileText size={14} /> PDF
      </Button>
    </div>
  )
}
