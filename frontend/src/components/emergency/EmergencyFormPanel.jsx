import { Flame, HeartPulse, Shield, Waves, AlertTriangle, Locate } from "lucide-react"

const emergencyTypes = [
  { 
    value: "fire", 
    label: "Fire", 
    icon: Flame, 
    activeClass: "border-red-500 bg-red-50/50 text-red-700 ring-1 ring-red-500", 
    iconBg: "bg-red-100 text-red-600" 
  },
  { 
    value: "medical", 
    label: "Medical", 
    icon: HeartPulse, 
    activeClass: "border-green-500 bg-green-50/50 text-green-700 ring-1 ring-green-500", 
    iconBg: "bg-green-100 text-green-600" 
  },
  { 
    value: "security", 
    label: "Security", 
    icon: Shield, 
    activeClass: "border-blue-500 bg-blue-50/50 text-blue-700 ring-1 ring-blue-500", 
    iconBg: "bg-blue-100 text-blue-600" 
  },
  { 
    value: "natural_disaster", 
    label: "Natural Disaster", 
    icon: Waves, 
    activeClass: "border-orange-500 bg-orange-50/50 text-orange-700 ring-1 ring-orange-500", 
    iconBg: "bg-orange-100 text-orange-600" 
  },
  { 
    value: "other", 
    label: "Other", 
    icon: AlertTriangle, 
    activeClass: "border-purple-500 bg-purple-50/50 text-purple-700 ring-1 ring-purple-500", 
    iconBg: "bg-purple-100 text-purple-600" 
  },
]

export default function EmergencyFormPanel({
  form,
  setForm,
  onSubmit,
  onCancel,
  loading,
  onLocateMe
}) {
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === "radius" ? Number(value) : value,
    }))
  }

  const handleTypeSelect = (typeValue) => {
    setForm((prev) => ({
      ...prev,
      type: typeValue,
    }))
  }

  return (
    <div className="flex flex-col h-full bg-[#fafafa]">
      {/* Panel Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200 bg-white shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">Report Emergency</h2>
          <p className="text-xs text-gray-500">Provide emergency details below</p>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* 1. Emergency Type Selectors */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Emergency Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {emergencyTypes.map((item) => {
              const Icon = item.icon
              const isSelected = form.type === item.value

              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleTypeSelect(item.value)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? item.activeClass
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full mb-1 shrink-0 ${isSelected ? item.iconBg : "bg-gray-100 text-gray-500"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2. Description Textarea */}
        <div className="space-y-1">
          <label htmlFor="description" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Describe the situation (Optional)"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
        </div>

        {/* 3. Address Field */}
        <div className="space-y-1">
          <label htmlFor="address" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Address / Landmark
          </label>
          <input
            id="address"
            name="address"
            type="text"
            value={form.address}
            onChange={handleChange}
            placeholder="Nearby street name, area, or landmark"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
        </div>

        {/* 4. Location Details & Geolocation */}
        <div className="space-y-2 hidden">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Location Coordinates
            </label>
            <button
              type="button"
              onClick={onLocateMe}
              className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              <Locate className="h-3.5 w-3.5" />
              Locate Me
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-600">
            <div>
              <span className="font-semibold text-gray-700 block">Latitude:</span>
              <span className="font-mono text-gray-900">{form.latitude.toFixed(6)}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700 block">Longitude:</span>
              <span className="font-mono text-gray-900">{form.longitude.toFixed(6)}</span>
            </div>
          </div>
        </div>

        {/* 5. Responder Search Radius */}
        <div className="space-y-2 hidden">
          <div className="flex items-center justify-between">
            <label htmlFor="radius" className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Responder Search Radius
            </label>
            <span className="text-xs font-bold text-red-600">
              {(form.radius / 1000).toFixed(0)} km
            </span>
          </div>
          <input
            id="radius"
            name="radius"
            type="range"
            min="1000"
            max="50000"
            step="1000"
            value={form.radius}
            onChange={handleChange}
            className="w-full accent-red-600 cursor-pointer h-1 bg-gray-200 rounded-lg appearance-none"
          />
          <p className="text-[10px] text-gray-500 leading-tight">
            Responders inside this circle on the map will receive real-time notifications immediately.
          </p>
        </div>

        {/* 6. Form Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 shrink-0">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-75 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 text-sm transition-all duration-200 shadow-md shadow-red-500/10 cursor-pointer"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {loading ? "Reporting Emergency..." : "Submit Emergency Report"}
          </button>
          
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2.5 px-4 text-sm transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
