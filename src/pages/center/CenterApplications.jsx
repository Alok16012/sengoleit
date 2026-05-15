import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

export default function CenterApplications() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return
    fetchApplications()
  }, [user])

  async function fetchApplications() {
    setLoading(true)
    const { data } = await supabase
      .from('center_applications')
      .select('*')
      .order('created_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  async function handleApprove(app) {
    const centerCode = `CTR${Date.now().toString().slice(-6)}`
    const generatedPassword = Math.random().toString(36).slice(-8).toUpperCase()

    await supabase.from('centers').insert({
      center_name: app.organization_name || app.full_name,
      email: app.email,
      phone: app.phone,
      address: app.permanent_address,
      state_id: app.permanent_state_id,
      district_id: app.permanent_district_id,
      pincode: app.permanent_pin_code,
      center_code: centerCode,
      generated_password: generatedPassword,
      status: 'Active',
      kyc_status: 'Verified',
      bank_account_holder: app.account_holder_name,
      bank_account_number: app.account_no,
      ifsc_code: app.ifc_code,
      bank_branch: app.branch,
    })

    await supabase.from('center_applications').update({ status: 'Approved' }).eq('id', app.id)
    fetchApplications()
    alert(`Center approved! Code: ${centerCode}, Password: ${generatedPassword}`)
  }

  async function handleReject(id) {
    if (!confirm('Reject this application?')) return
    await supabase.from('center_applications').update({ status: 'Rejected' }).eq('id', id)
    fetchApplications()
  }

  return (
    <div className="p-6">
      <PageHeader title="Center Applications" subtitle={`${data.length} applications`} />
      {loading ? <div className="text-center py-16 text-gray-400">Loading...</div> : (
        <Table>
          <Thead>
            <tr><Th>Applicant</Th><Th>Organization</Th><Th>Phone</Th><Th>Date</Th><Th>Status</Th><Th>Actions</Th></tr>
          </Thead>
          <Tbody>
            {data.length === 0 ? <tr><Td colSpan={6} className="text-center text-gray-400 py-8">No applications</Td></tr>
              : data.map(a => (
                <tr key={a.id}>
                  <Td><p className="font-medium text-gray-900">{a.full_name}</p><p className="text-xs text-gray-400">{a.email}</p></Td>
                  <Td>{a.organization_name || '—'}</Td>
                  <Td>{a.phone || '—'}</Td>
                  <Td>{a.date_of_submission || (a.created_at ? new Date(a.created_at).toLocaleDateString() : '—')}</Td>
                  <Td><Badge status={a.status?.toLowerCase()}>{a.status || 'Pending'}</Badge></Td>
                  <Td>
                    {(!a.status || a.status === 'Pending') && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApprove(a)}>Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => handleReject(a.id)}>Reject</Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
