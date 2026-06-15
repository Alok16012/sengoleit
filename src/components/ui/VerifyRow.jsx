import { CheckCircle, ExternalLink, Lock } from 'lucide-react'

// Single verifiable field/document row used in the Document & Account
// department verify modals. Kept at module scope (stable identity) so that
// updating one field's check state does NOT remount the whole list and jump
// the scroll position back to the top.
export default function VerifyRow({ fkey, label, val, url, checks, setChecks }) {
  const check = checks[fkey]
  const isVerified = check?.ok
  const isLocked = check?.locked
  const isDoc = url !== undefined
  const missing = isDoc ? !url : !val
  return (
    <div className={`rounded-xl border transition-all duration-150 ${
      isVerified
        ? isLocked
          ? 'bg-gray-50 border-gray-200'
          : 'bg-emerald-50 border-emerald-200 shadow-sm'
        : missing
          ? 'bg-amber-50/60 border-dashed border-amber-200'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}>
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-tight">{label}</p>
          <div className="mt-1">
            {isDoc
              ? url
                ? <a href={url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#933d18] hover:underline">
                    <ExternalLink size={11} /> View Document
                  </a>
                : <span className="text-xs font-medium text-amber-600">Not uploaded</span>
              : <p className="text-sm font-semibold text-gray-900 break-words leading-snug">
                  {val || <span className="text-gray-400 font-normal text-xs italic">Not provided</span>}
                </p>
            }
          </div>
        </div>
        <div className="shrink-0 mt-0.5 flex items-center gap-1.5">
          {isVerified
            ? isLocked
              ? <span title="Pehle se verified — locked"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-300 px-2.5 py-1 rounded-lg cursor-not-allowed">
                  <Lock size={10} /> Verified
                </span>
              : <button onClick={() => setChecks(p => ({ ...p, [fkey]: { ...p[fkey], ok: false } }))}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-200 transition-colors">
                  <CheckCircle size={11} /> Verified
                </button>
            : <>
                <button onClick={() => setChecks(p => ({ ...p, [fkey]: { ...(p[fkey] || {}), ok: false, showRemark: !p[fkey]?.showRemark } }))}
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                    check?.showRemark || check?.remark
                      ? 'text-red-600 border-red-200 bg-red-50'
                      : 'text-gray-400 border-gray-200 bg-gray-50 hover:border-red-300 hover:text-red-500'
                  }`}>
                  Remark
                </button>
                <button onClick={() => setChecks(p => ({ ...p, [fkey]: { ok: true, remark: p[fkey]?.remark || '' } }))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 border border-gray-200 bg-gray-50 hover:border-[#933d18] hover:text-[#933d18] hover:bg-[#933d18]/5 px-2.5 py-1 rounded-lg transition-colors">
                  Verify
                </button>
              </>
          }
        </div>
      </div>
      {!isVerified && (check?.showRemark || check?.remark) && (
        <div className="px-3 pb-3 pt-0">
          <input
            type="text"
            placeholder="Is field mein kya dikkat hai..."
            value={check?.remark || ''}
            onChange={e => setChecks(p => ({ ...p, [fkey]: { ...(p[fkey] || {}), ok: false, remark: e.target.value } }))}
            className="w-full text-xs text-gray-600 placeholder:text-gray-300 bg-transparent border-0 border-t border-gray-100 pt-2 focus:outline-none"
          />
        </div>
      )}
    </div>
  )
}
