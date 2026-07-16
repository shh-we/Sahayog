import { useState, useEffect, useCallback } from "react"
import { getPendingUsers, approveUser, rejectUser } from "../../api/admin.js"
import toast from "react-hot-toast"
import { Loader2, UserCheck, Search, CheckCircle2, XCircle, AlertCircle } from "lucide-react"

export default function VerificationQueue() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({}) // { [userId]: "approve" | "reject" }
  const [actionError, setActionError] = useState({})     // { [userId]: string }
  const [searchQuery, setSearchQuery] = useState("")

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getPendingUsers({ limit: 100 })
      setUsers(res.data.users || [])
    } catch (err) {
      console.error("Error fetching pending users:", err)
      toast.error("Failed to load verification queue")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  const handleApprove = async (userId) => {
    setActionLoading((prev) => ({ ...prev, [userId]: "approve" }))
    setActionError((prev) => { const n = { ...prev }; delete n[userId]; return n })
    try {
      await approveUser(userId)
      setUsers((prev) => prev.filter((u) => u._id !== userId))
      toast.success("User approved successfully")
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to approve user"
      setActionError((prev) => ({ ...prev, [userId]: msg }))
      toast.error(msg)
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[userId]; return n })
    }
  }

  const handleReject = async (userId) => {
    setActionLoading((prev) => ({ ...prev, [userId]: "reject" }))
    setActionError((prev) => { const n = { ...prev }; delete n[userId]; return n })
    try {
      await rejectUser(userId)
      setUsers((prev) => prev.filter((u) => u._id !== userId))
      toast.success("User rejected and removed")
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to reject user"
      setActionError((prev) => ({ ...prev, [userId]: msg }))
      toast.error(msg)
    } finally {
      setActionLoading((prev) => { const n = { ...prev }; delete n[userId]; return n })
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "—"
    const d = new Date(dateStr)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    return !q || u.name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#1f73b7]" />
          <p className="text-sm font-medium text-gray-400">Loading queue...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900">Pending Approvals Queue</h1>
        <p className="text-sm text-gray-500 max-w-xl">
          Review and verify incoming registration requests. Unapproved accounts cannot log into the system.
        </p>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">Pending Requests</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              {filteredUsers.length}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1f73b7]/20 focus:border-[#1f73b7] transition-all w-56"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <UserCheck className="w-10 h-10 text-gray-200" />
              <div>
                <p className="text-sm font-semibold text-gray-400">
                  {users.length === 0 ? "No pending requests" : "No results match your search"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {users.length === 0
                    ? "All accounts are approved or no new registrations yet."
                    : "Try a different name or phone number."}
                </p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Full Name
                  </th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Registration Date
                  </th>
                  <th className="text-left px-6 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => {
                  const busy = !!actionLoading[u._id]
                  const err = actionError[u._id]
                  const isApproving = actionLoading[u._id] === "approve"
                  const isRejecting = actionLoading[u._id] === "reject"

                  return (
                    <tr key={u._id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Full Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-[#1f73b7]/10 flex items-center justify-center text-[#1f73b7] font-bold text-xs select-none">
                            {u.name?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{u.name || "—"}</p>
                            <p className="text-xs text-gray-400">{u.email || "—"}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700">{u.phone || "—"}</span>
                      </td>

                      {/* Registration Date */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-700 font-mono">{formatDate(u.createdAt)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            {/* Approve */}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleApprove(u._id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isApproving
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <CheckCircle2 className="w-3.5 h-3.5" />}
                              {isApproving ? "Approving…" : "Approve"}
                            </button>

                            {/* Reject */}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleReject(u._id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isRejecting
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <XCircle className="w-3.5 h-3.5" />}
                              {isRejecting ? "Rejecting…" : "Reject"}
                            </button>
                          </div>

                          {/* Inline error */}
                          {err && (
                            <div className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{err}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer count */}
        {filteredUsers.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">
              Showing{" "}
              <span className="font-semibold text-gray-600">{filteredUsers.length}</span>{" "}
              pending request{filteredUsers.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
