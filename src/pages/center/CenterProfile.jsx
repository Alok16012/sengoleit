import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../utils/formatDate'
import Badge from '../../components/ui/Badge'
import { Building2, User, MapPin, Briefcase, Landmark, GraduationCap, Wallet } from 'lucide-react'

const SELECT =
  '*, states!state_id(state_name), districts!district_id(district_name), countries!country_id(country_name), ' +
  'org_state:states!org_state_id(state_name), org_district:districts!org_district_id(district_name), org_country:countries!org_country_id(country_name)'

function buildSections(c) {
  return [
    ['Center Identity', Building2, [
      ['Center Name', c.center_name],
      ['Center Code', c.center_code],
      ['Application No', c.application_no],
      ['Date of Submission', c.date_of_submission ? formatDate(c.date_of_submission) : '—'],
      ['Year of Established', c.establishment_year],
    ]],
    ['Contact Person', User, [
      ['Contact Person', c.contact_person],
      ["Father / Mother's Name", c.father_mother_name],
      ['Date of Birth', c.date_of_birth ? formatDate(c.date_of_birth) : '—'],
      ['Gender', c.gender],
      ['Nationality', c.nationality],
      ['Aadhar No', c.aadhar_no],
      ['PAN No', c.pan_no],
      ['Mobile Number', c.contact_mobile || c.phone],
      ['Email', c.contact_email || c.email],
      ['Current Occupation', c.current_occupation],
      ['Experience in Admissions', c.previous_experience_admissions],
    ]],
    ['Address', MapPin, [
      ['Current Address', c.current_address || c.address_line1 || c.address],
      ['Permanent Address', c.permanent_address],
      ['Country', c.countries?.country_name],
      ['State', c.states?.state_name],
      ['District', c.districts?.district_name],
      ['Pincode', c.pincode],
    ]],
    ['Organization', Briefcase, [
      ['Organization Name', c.organization_name],
      ['Organization Type', c.org_type],
      ['Organization Address', c.org_address],
      ['Org Post Office', c.org_post_office],
      ['Org City', c.org_city],
      ['Org Country', c.org_country?.country_name],
      ['Org State', c.org_state?.state_name],
      ['Org District', c.org_district?.district_name],
      ['Org Pincode', c.org_pincode],
      ['Registration Number', c.registration_number],
      ['GST / PAN', c.gst_pan],
      ['Premises Type', c.premises_type],
      ['Office Area (sqft)', c.office_area_sqft],
      ['Student Capacity', c.student_capacity],
    ]],
    ['Bank Details', Landmark, [
      ['Account Holder', c.bank_account_holder],
      ['Account Number', c.bank_account_number],
      ['IFSC Code', c.ifsc_code],
      ['Branch', c.bank_branch],
    ]],
    ['Education', GraduationCap, [
      ['10th', [c.edu_10th_institute, c.edu_10th_board, c.edu_10th_year].filter(Boolean).join(' • ')],
      ['12th', [c.edu_12th_institute, c.edu_12th_board, c.edu_12th_year].filter(Boolean).join(' • ')],
      ['UG', [c.edu_ug_institute, c.edu_ug_board, c.edu_ug_year].filter(Boolean).join(' • ')],
      ['PG', [c.edu_pg_institute, c.edu_pg_board, c.edu_pg_year].filter(Boolean).join(' • ')],
      ['Diploma', [c.edu_diploma_institute, c.edu_diploma_board, c.edu_diploma_year].filter(Boolean).join(' • ')],
    ]],
    ['Payment', Wallet, [
      ['Amount Paid', c.amount_paid ? `Rs. ${Number(c.amount_paid).toLocaleString('en-IN')}` : '—'],
      ['UTR Number', c.utr_number],
      ['Letter Type', c.letter_type],
      ['Virtual Balance', `Rs. ${Number(c.virtual_balance || 0).toLocaleString('en-IN')}`],
    ]],
  ]
}

export default function CenterProfile() {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select(SELECT).eq('email', user.email).single()
      .then(({ data }) => { setCenter(data); setLoading(false) })
  }, [user])

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#933d18] border-t-transparent" />
    </div>
  )

  if (!center) return (
    <div className="p-6"><p className="text-gray-500">No center profile found.</p></div>
  )

  const sections = buildSections(center)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-[#933d18] rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white font-black text-2xl">{center.center_name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{center.center_name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5">
              {center.center_code && (
                <span className="bg-[#933d18]/10 text-[#933d18] text-xs font-bold px-2 py-0.5 rounded-lg">{center.center_code}</span>
              )}
              <Badge status={center.approval_status}>{center.approval_status || 'Pending'}</Badge>
              <Badge status={center.kyc_status?.toLowerCase()}>KYC: {center.kyc_status || 'Pending'}</Badge>
              <Badge status={center.status?.toLowerCase()}>{center.status || 'Inactive'}</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sections.map(([title, Icon, rows]) => (
          <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon size={18} className="text-[#933d18]" />
              <h2 className="font-bold text-gray-800">{title}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {rows.map(([label, value], i) => (
                <div key={i}>
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="font-semibold text-gray-900 break-words">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
