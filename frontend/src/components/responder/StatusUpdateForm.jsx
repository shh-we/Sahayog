import { useState } from 'react'
import { Car, MapPin, CheckCircle } from 'lucide-react'
import { updateResponseStatus } from '../../api/responder.js'
import toast from 'react-hot-toast'

export default function StatusUpdateForm({ emergency, onClose, onStatusUpdated }) {
  const [selectedStatus, setSelectedStatus] = useState('en_route')
  const [loading, setLoading] = useState(false)

  const statusOptions = [
    {
      value: 'en_route',
      label: 'En Route',
      icon: Car,
      description: 'Heading to the emergency location'
    },
    {
      value: 'on_scene',
      label: 'On Scene',
      icon: MapPin,
      description: 'Arrived at the emergency location'
    },
    {
      value: 'completed',
      label: 'Completed',
      icon: CheckCircle,
      description: 'Emergency response completed'
    }
  ]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      await updateResponseStatus(emergency._id, selectedStatus)
      toast.success(`Status updated to ${selectedStatus}!`)
      onStatusUpdated?.()
      onClose()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error(error.response?.data?.message || 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>
          Update Response Status
        </h2>
        
        <div style={{ marginBottom: '16px' }}>
          <p style={{ margin: '0 0 8px 0', color: '#666', fontSize: '14px' }}>
            <strong>Emergency Type:</strong> {emergency.type.toUpperCase()}
          </p>
          <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
            <strong>Description:</strong> {emergency.description}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '12px', fontWeight: '500' }}>
              Select Status:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {statusOptions.map((option) => (
                <label
                  key={option.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '12px',
                    border: `2px solid ${selectedStatus === option.value ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: selectedStatus === option.value ? '#eff6ff' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={selectedStatus === option.value}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    style={{
                      marginRight: '12px',
                      marginTop: '2px',
                      cursor: 'pointer'
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '500', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <option.icon size={18} />
                      {option.label}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            marginTop: '24px'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#f9fafb'}
              onMouseOut={(e) => e.target.style.backgroundColor = 'white'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: loading ? '#9ca3af' : '#3b82f6',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#2563eb')}
              onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#3b82f6')}
            >
              {loading ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
