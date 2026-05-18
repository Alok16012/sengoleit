/*
  SQL to run in Supabase before using this page:

  ALTER TABLE centers
    ADD COLUMN IF NOT EXISTS owner_photo_url     text,
    ADD COLUMN IF NOT EXISTS owner_signature_url text,
    ADD COLUMN IF NOT EXISTS owner_aadhar_url    text,
    ADD COLUMN IF NOT EXISTS owner_pan_url       text,
    ADD COLUMN IF NOT EXISTS center_reg_url      text,
    ADD COLUMN IF NOT EXISTS premises_photo_url  text,
    ADD COLUMN IF NOT EXISTS gst_url             text,
    ADD COLUMN IF NOT EXISTS agreement_url       text,
    ADD COLUMN IF NOT EXISTS cancel_cheque_url   text,
    ADD COLUMN IF NOT EXISTS bank_passbook_url   text;
*/

import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import FormSection from '../../components/ui/FormSection'
import Button from '../../components/ui/Button'
import {
  User, Building2, CreditCard, Upload, Eye,
  CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Save, Check
} from 'lucide-react'

const STEPS = [
  { label: 'Identity Documents', icon: User },
  { label: 'Center Documents', icon: Building2 },
  { label: 'Bank Documents', icon: CreditCard },
]

function FileCard({ label, fieldKey, accept, isImage, value, onUpload, isUploading, hint }) {
  return (
    <div className="bg-gray-50/60 rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        {value && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 size={10} /> Uploaded
          </span>
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 px-4 pb-1">{hint}</p>}

      {/* Preview area */}
      <div className="flex flex-col items-center justify-center px-4 py-4 gap-3">
        {value && isImage ? (
          <img src={value} alt={label}
            className="h-28 w-full object-contain rounded-lg border border-gray-200 bg-white shadow-sm" />
        ) : value && !isImage ? (
          <div className="h-20 w-full rounded-lg border-2 border-[#933d18]/20 bg-[#933d18]/5 flex items-center justify-center gap-2">
            <Upload size={18} className="text-[#933d18]/60" />
            <span className="text-xs font-semibold text-[#933d18]/80">Document uploaded</span>
          </div>
        ) : (
          <div className="h-20 w-full rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-white">
            <p className="text-xs text-gray-300 font-medium">No file yet</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-all
            ${isUploading
              ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50'
              : 'border-[#933d18]/30 text-[#933d18] hover:bg-[#933d18]/5 bg-white'}`}>
            <Upload size={11} />
            {isUploading ? 'Uploading...' : value ? 'Replace' : 'Upload'}
            <input type="file" accept={accept} className="hidden" disabled={isUploading}
              onChange={e => e.target.files[0] && onUpload(fieldKey, e.target.files[0])} />
          </label>
          {value && (
            <a href={value} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all">
              <Eye size={11} /> View
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CenterDocuments() {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [loadErr, setLoadErr] = useState('')
  const [docs, setDocs] = useState({
    owner_photo_url: '',
    owner_signature_url: '',
    owner_aadhar_url: '',
    owner_pan_url: '',
    center_reg_url: '',
    premises_photo_url: '',
    gst_url: '',
    agreement_url: '',
    cancel_cheque_url: '',
    bank_passbook_url: '',
  })
  const [uploading, setUploading] = useState({})
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  useEffect(() => {
    if (!user?.email) return
    supabase
      .from('centers')
      .select('id, center_name, owner_photo_url, owner_signature_url, owner_aadhar_url, owner_pan_url, center_reg_url, premises_photo_url, gst_url, agreement_url, cancel_cheque_url, bank_passbook_url')
      .eq('email', user.email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { setLoadErr('Could not load center data: ' + error.message); return }
        if (!data) { setLoadErr('No center account linked to your email.'); return }
        setCenter(data)
        setDocs({
          owner_photo_url:     data.owner_photo_url     || '',
          owner_signature_url: data.owner_signature_url || '',
          owner_aadhar_url:    data.owner_aadhar_url    || '',
          owner_pan_url:       data.owner_pan_url       || '',
          center_reg_url:      data.center_reg_url      || '',
          premises_photo_url:  data.premises_photo_url  || '',
          gst_url:             data.gst_url             || '',
          agreement_url:       data.agreement_url       || '',
          cancel_cheque_url:   data.cancel_cheque_url   || '',
          bank_passbook_url:   data.bank_passbook_url   || '',
        })
      })
  }, [user?.email])

  async function handleUpload(fieldKey, file) {
    if (!center?.id) return
    setSaveErr('')
    setUploading(u => ({ ...u, [fieldKey]: true }))
    try {
      const ext = file.name.split('.').pop()
      const path = `centers/${center.id}/${fieldKey}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      setDocs(d => ({ ...d, [fieldKey]: publicUrl }))
      // Auto-save immediately after upload
      await supabase.from('centers').update({ [fieldKey]: publicUrl }).eq('id', center.id)
    } catch (err) {
      setSaveErr('Upload failed: ' + err.message)
    }
    setUploading(u => ({ ...u, [fieldKey]: false }))
  }

  async function handleSaveAll() {
    if (!center?.id) return
    setSaving(true)
    setSaveErr('')
    const { error } = await supabase.from('centers').update(docs).eq('id', center.id)
    setSaving(false)
    if (error) { setSaveErr('Save failed: ' + error.message); return }
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  // Upload count per step
  const stepUploaded = [
    ['owner_photo_url', 'owner_signature_url', 'owner_aadhar_url', 'owner_pan_url'],
    ['center_reg_url', 'premises_photo_url', 'gst_url', 'agreement_url'],
    ['cancel_cheque_url', 'bank_passbook_url'],
  ].map(keys => keys.filter(k => !!docs[k]).length)

  const stepTotal = [4, 4, 2]

  if (loadErr) {
    return (
      <div className="p-6">
        <PageHeader title="Center Documents" />
        <div className="mt-6 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-sm text-red-700">
          <AlertCircle size={15} /> {loadErr}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 pb-20">
      <PageHeader
        title="Center Documents"
        subtitle={center?.center_name || 'Upload your KYC & verification documents'}
      />

      {/* Step header */}
      <div className="sticky top-0 z-20 mt-4 mb-5 bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-stretch min-w-max">
            {STEPS.map((s, i) => {
              const isActive = step === i
              const isPast = i < step
              const Icon = s.icon
              const uploaded = stepUploaded[i]
              const total = stepTotal[i]
              return (
                <div key={i} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => { if (isPast) setStep(i) }}
                    className={`relative flex items-center gap-3 px-5 py-3.5 transition-all
                      ${isActive
                        ? 'bg-[#933d18] text-white'
                        : isPast
                          ? 'bg-[#933d18]/8 text-[#933d18]/70 hover:bg-[#933d18]/12 cursor-pointer'
                          : 'text-gray-400 cursor-default'
                      }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0
                      ${isActive ? 'bg-white/20 text-white' : isPast ? 'bg-[#933d18]/20 text-[#933d18]' : 'bg-gray-100 text-gray-400'}`}>
                      {isPast ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} className={isActive ? 'text-white/80' : isPast ? 'text-[#933d18]/60' : 'text-gray-300'} />
                        <span className={`text-xs font-bold whitespace-nowrap ${isActive ? 'text-white' : isPast ? 'text-[#933d18]/80' : 'text-gray-500'}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className={`text-[9px] font-semibold mt-0.5 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                        {uploaded}/{total} uploaded
                      </p>
                    </div>
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/40 rounded-full" />}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-px self-stretch my-2 ${isPast ? 'bg-[#933d18]/20' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Save error */}
      {saveErr && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" /> {saveErr}
        </div>
      )}

      {/* Save success */}
      {saveSuccess && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
          <Check size={15} /> Documents saved successfully.
        </div>
      )}

      {/* STEP 0: Identity Documents */}
      {step === 0 && (
        <FormSection title="Identity Documents" icon={<User size={16} />}
          subtitle="Upload owner's personal identity documents">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FileCard
              label="Owner Photo *"
              fieldKey="owner_photo_url"
              accept="image/*"
              isImage
              value={docs.owner_photo_url}
              onUpload={handleUpload}
              isUploading={!!uploading.owner_photo_url}
              hint="Passport-size clear photo of the center owner"
            />
            <FileCard
              label="Owner Signature *"
              fieldKey="owner_signature_url"
              accept="image/*"
              isImage
              value={docs.owner_signature_url}
              onUpload={handleUpload}
              isUploading={!!uploading.owner_signature_url}
              hint="Signature on white paper, scanned or photographed"
            />
            <FileCard
              label="Aadhar Card *"
              fieldKey="owner_aadhar_url"
              accept="image/*,application/pdf"
              isImage={false}
              value={docs.owner_aadhar_url}
              onUpload={handleUpload}
              isUploading={!!uploading.owner_aadhar_url}
              hint="Front & back of Aadhar card (PDF or image)"
            />
            <FileCard
              label="PAN Card *"
              fieldKey="owner_pan_url"
              accept="image/*,application/pdf"
              isImage={false}
              value={docs.owner_pan_url}
              onUpload={handleUpload}
              isUploading={!!uploading.owner_pan_url}
              hint="Owner's PAN card (PDF or image)"
            />
          </div>
        </FormSection>
      )}

      {/* STEP 1: Center / Organization Documents */}
      {step === 1 && (
        <FormSection title="Center Documents" icon={<Building2 size={16} />}
          subtitle="Upload organization and premises-related documents">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FileCard
              label="Center Registration Certificate *"
              fieldKey="center_reg_url"
              accept="image/*,application/pdf"
              isImage={false}
              value={docs.center_reg_url}
              onUpload={handleUpload}
              isUploading={!!uploading.center_reg_url}
              hint="Society / trust / company registration certificate"
            />
            <FileCard
              label="Premises Photo *"
              fieldKey="premises_photo_url"
              accept="image/*"
              isImage
              value={docs.premises_photo_url}
              onUpload={handleUpload}
              isUploading={!!uploading.premises_photo_url}
              hint="Clear photo of the center building / office"
            />
            <FileCard
              label="GST Certificate"
              fieldKey="gst_url"
              accept="image/*,application/pdf"
              isImage={false}
              value={docs.gst_url}
              onUpload={handleUpload}
              isUploading={!!uploading.gst_url}
              hint="GST registration certificate (if applicable)"
            />
            <FileCard
              label="Agreement Document *"
              fieldKey="agreement_url"
              accept="image/*,application/pdf"
              isImage={false}
              value={docs.agreement_url}
              onUpload={handleUpload}
              isUploading={!!uploading.agreement_url}
              hint="Signed agreement / MOU with the university"
            />
          </div>
        </FormSection>
      )}

      {/* STEP 2: Bank Documents */}
      {step === 2 && (
        <FormSection title="Bank Documents" icon={<CreditCard size={16} />}
          subtitle="Upload bank verification documents">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FileCard
              label="Cancel Cheque *"
              fieldKey="cancel_cheque_url"
              accept="image/*,application/pdf"
              isImage={false}
              value={docs.cancel_cheque_url}
              onUpload={handleUpload}
              isUploading={!!uploading.cancel_cheque_url}
              hint="Cancelled cheque for the bank account on record"
            />
            <FileCard
              label="Bank Passbook / Statement *"
              fieldKey="bank_passbook_url"
              accept="image/*,application/pdf"
              isImage={false}
              value={docs.bank_passbook_url}
              onUpload={handleUpload}
              isUploading={!!uploading.bank_passbook_url}
              hint="First page of passbook or recent bank statement"
            />
          </div>

          {/* Upload summary */}
          <div className="mt-2 bg-gray-50 rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Upload Summary</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                ['Owner Photo', docs.owner_photo_url],
                ['Owner Signature', docs.owner_signature_url],
                ['Aadhar Card', docs.owner_aadhar_url],
                ['PAN Card', docs.owner_pan_url],
                ['Registration Cert.', docs.center_reg_url],
                ['Premises Photo', docs.premises_photo_url],
                ['GST Certificate', docs.gst_url],
                ['Agreement', docs.agreement_url],
                ['Cancel Cheque', docs.cancel_cheque_url],
                ['Bank Passbook', docs.bank_passbook_url],
              ].map(([label, url]) => (
                <div key={label} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <span className="text-[11px] text-gray-600 truncate">{label}</span>
                  {url
                    ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    : <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0" />
                  }
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {[...Object.values(docs)].filter(Boolean).length} of 10 documents uploaded.
              Documents are auto-saved after each upload.
            </p>
          </div>
        </FormSection>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 pb-8">
        <div>
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft size={14} /> Back
            </Button>
          )}
        </div>
        <div>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(s => s + 1)}>
              Next <ArrowRight size={14} />
            </Button>
          ) : (
            <Button type="button" onClick={handleSaveAll} disabled={saving || !center}>
              {saving ? 'Saving...' : saveSuccess ? <><Check size={14} /> Saved!</> : <><Save size={14} /> Save Documents</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
