import { useState, useEffect } from "react"
import { getAllResponders, createResponder } from "../../api/admin.js"
import toast from "react-hot-toast"
import { Loader2, Users, Search, Shield, Phone, Mail, X } from "lucide-react"

export default function RespondersDirectory() {
  const [responders, setResponders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    type: "Police",
    status: "Available"
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchResponders = async () => {
      try {
        setLoading(true)
        const res = await getAllResponders({ limit: 100 })
        setResponders(res.data.responders || [])
      } catch (err) {
        console.error("Error fetching responders:", err)
        toast.error("Failed to load responders directory")
      } finally {
        setLoading(false)
      }
    }
    fetchResponders()
  }, [])

  const filteredResponders = responders.filter((r) => {
    const q = searchQuery.toLowerCase()
    return (
      !q ||
      r.name?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      r.skills?.some(skill => skill.toLowerCase().includes(q))
    )
  })

  // Map skills to specialized responder types cleanly
  const mapResponderType = (skills = []) => {
    const s = skills.map(x => x.toLowerCase())
    if (s.includes("medical")) return "Ambulance"
    if (s.includes("fire")) return "Fire"
    if (s.includes("security")) return "Police"
    return "General Support"
  }

  // Get standardized status & styling
  const getStatusDetails = (responder) => {
    const statusVal = responder.status || (responder.isAvailable ? "available" : "offline")
    const norm = statusVal.toLowerCase()

    if (norm === "available" || norm === "active" || norm === "on_duty") {
      return {
        label: "Available",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
        dotClass: "bg-emerald-500"
      }
    }
    if (norm === "busy" || norm === "assigned" || norm === "en_route" || norm === "in_progress") {
      return {
        label: "Busy",
        badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
        dotClass: "bg-amber-500"
      }
    }
    return {
      label: "Offline",
      badgeClass: "bg-gray-50 text-gray-600 border-gray-200",
      dotClass: "bg-gray-400"
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !formData.email || !formData.password) {
      toast.error("Please fill in all required fields")
      return
    }

    if (formData.phone.length !== 10 && !formData.phone.startsWith("+")) {
      toast.error("Please enter a valid phone number")
      return
    }

    setSubmitting(true)

    // Map responder type selection to skill tags
    let skills = ["general"]
    if (formData.type === "Police") skills = ["security"]
    if (formData.type === "Fire") skills = ["fire"]
    if (formData.type === "Ambulance") skills = ["medical"]

    // Fix 3: isAvailable is true ONLY for "Available" status.
    // Both "Busy" and "Offline" map to isAvailable: false so that dispatch
    // candidate queries (which filter isAvailable: true) correctly skip them.
    const isAvailable = formData.status === "Available"
    const status = formData.status.toLowerCase()

    try {
      const res = await createResponder({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        password: formData.password,
        skills,
        isAvailable,
        status
      })
      toast.success("Responder created successfully")
      setResponders((prev) => [res.data.responder, ...prev])
      setShowModal(false)
      // Reset form
      setFormData({
        name: "",
        phone: "",
        email: "",
        password: "",
        type: "Police",
        status: "Available"
      })
    } catch (err) {
      console.error(err)
      toast.error(err?.response?.data?.message || "Failed to create responder")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1f73b7]" />
          <p className="text-sm font-medium text-gray-400">Loading directory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-gray-900">Registered Responders</h1>
          <p className="text-sm text-gray-500 max-w-xl">
            All active, verified responders in the Sahayog network.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#1f73b7] hover:bg-[#1a629b] text-white text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <span>+ Add New Responder</span>
        </button>
      </div>

      {/* Directory Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">All Responders</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              {filteredResponders.length}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, phone or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filteredResponders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <Users className="w-10 h-10 text-gray-200" />
              <div>
                <p className="text-sm font-semibold text-gray-400">
                  {responders.length === 0 ? "No responders found" : "No results match your search"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {responders.length === 0
                    ? "Add responders to the system to get started."
                    : "Try a different name or skill."}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Responder Name
                  </th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Responder Type
                  </th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Contact Details
                  </th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredResponders.map((r) => {
                  const statusInfo = getStatusDetails(r)
                  return (
                    <tr key={r._id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Responder Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-[#1f73b7]/10 flex items-center justify-center text-[#1f73b7] font-bold text-xs select-none">
                            {r.name?.charAt(0).toUpperCase() || "R"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{r.name || "—"}</p>
                            <p className="text-xs text-gray-400 flex items-center gap-1">
                              <Shield className="w-3 h-3 text-[#1f73b7]" />
                              ID: {r._id.slice(-6).toUpperCase()}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Responder Type */}
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-[10px] font-bold capitalize">
                          {mapResponderType(r.skills)}
                        </span>
                      </td>

                      {/* Contact Details */}
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-xs text-gray-600">
                          <p className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{r.phone || "—"}</span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span className="truncate max-w-[180px]">{r.email}</span>
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusInfo.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Centered Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-[999] backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-[430px] shadow-xl overflow-hidden flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Add New Responder</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-px bg-gray-100 w-full" />

            {/* Modal Body Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all"
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="john.doe@sahayog.org"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Phone Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+977 9876543212"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all"
                />
              </div>

              {/* Columns for Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all"
                  >
                    <option value="Police">Police</option>
                    <option value="Fire">Fire</option>
                    <option value="Ambulance">Ambulance</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all"
                  >
                    <option value="Available">Available</option>
                    <option value="Busy">Busy</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#1f73b7] hover:bg-[#1a629b] text-white text-sm font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? "Creating..." : "Create Responder"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
