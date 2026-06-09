import PageInfo from '@/components/ui/PageInfo'
import Table from '@/components/ui/Table'

const schedules = [
  { id: '1', title: 'Weekend Flash Sale', platform: 'Facebook', datetime: '2026-06-14 09:00', repeat: 'Weekly', status: 'active' },
  { id: '2', title: 'New Product Launch', platform: 'Instagram', datetime: '2026-06-20 12:00', repeat: 'Once', status: 'active' },
  { id: '3', title: 'Customer Testimonial', platform: 'Facebook', datetime: '2026-06-15 18:00', repeat: 'Daily', status: 'paused' },
]

export default function SchedulePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">Schedule</h1>
          <p className="section-sub">View and manage recurring scheduled posts.</p>
        </div>
        <a href="/posts/schedule/new" className="btn-primary">
          + New Schedule
        </a>
      </div>

      <PageInfo
        purpose="Automate recurring posts on a fixed schedule. Set time, repeat interval, and platform."
        inputs={['Post content', 'Schedule time', 'Repeat interval (daily/weekly/monthly)', 'Platform']}
      />

      <div className="card">
        <Table
          headers={['Post Title', 'Platform', 'Schedule', 'Repeat', 'Status']}
        >
          {schedules.map(s => (
            <tr key={s.id}>
              <td className="px-4 py-3">{s.title}</td>
              <td className="px-4 py-3">{s.platform}</td>
              <td className="px-4 py-3">{s.datetime}</td>
              <td className="px-4 py-3">{s.repeat}</td>
              <td className="px-4 py-3"><span className={`badge-${s.status === 'active' ? 'active' : 'inactive'}`}>{s.status}</span></td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  )
}
