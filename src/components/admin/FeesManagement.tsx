import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../shared/Badge';
import { Modal } from '../shared/Modal';
import { StatCard } from '../shared/StatCard';
import { PageHeader } from '../shared/PageHeader';
import { IndianRupee, Search, Plus, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { FeePayment } from '../../types';
import { format, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';

export const FeesManagement: React.FC = () => {
  const { students, setStudents, feePayments, setFeePayments } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'partial' | 'due'>('all');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Online');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const totalCollected = feePayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = students.reduce((s, st) => s + (Number(st.totalFees) - Number(st.paidFees)), 0);
  const totalRevenue = students.reduce((s, st) => s + Number(st.totalFees), 0);
  const paidFull = students.filter(s => Number(s.paidFees) >= Number(s.totalFees)).length;

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.studentId.toLowerCase().includes(search.toLowerCase());
    const due = Number(s.totalFees) - Number(s.paidFees);
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'paid' && due <= 0) ||
      (filterStatus === 'partial' && due > 0 && Number(s.paidFees) > 0) ||
      (filterStatus === 'due' && Number(s.paidFees) === 0);
    return matchSearch && matchStatus;
  });

  // Dynamic Monthly Data for Analytics
  const monthlyData = React.useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    return months.map(month => {
      const monthTotal = feePayments
        .filter(p => isSameMonth(new Date(p.date), month))
        .reduce((sum, p) => sum + Number(p.amount), 0);
      return {
        month: format(month, 'MMM'),
        amount: monthTotal
      };
    });
  }, [feePayments]);

  const handleAddPayment = async () => {
    if (!selectedStudent || !paymentAmount || isSaving) return;
    const student = students.find(s => s.id === selectedStudent);
    if (!student) return;

    const amount = Number(paymentAmount);
    const newPaidFees = Number(student.paidFees) + amount;

    setIsSaving(true);
    try {
      const newPayment: Omit<FeePayment, 'id'> = {
        studentId: selectedStudent,
        amount: amount,
        date: new Date().toISOString().split('T')[0],
        mode: paymentMode,
        receiptNo: `REC${Date.now().toString().slice(-6)}`,
        note: paymentNote,
      };

      // 1. Save payment to Supabase
      const { data: savedPayment, error: payError } = await supabase
        .from('fee_payments')
        .insert({
          student_id: newPayment.studentId,
          amount: newPayment.amount,
          date: newPayment.date,
          mode: newPayment.mode,
          receipt_no: newPayment.receiptNo,
          note: newPayment.note
        })
        .select()
        .single();

      if (payError) throw payError;

      // 2. Update student's total paid fees in Supabase
      const { error: stuError } = await supabase
        .from('students')
        .update({ paid_fees: newPaidFees })
        .eq('id', selectedStudent);

      if (stuError) throw stuError;

      // 3. Update local state for immediate feedback
      const paymentWithId: FeePayment = {
        ...newPayment,
        id: savedPayment.id
      };

      setFeePayments(prev => [paymentWithId, ...prev]);
      setStudents(prev => prev.map(s => 
        s.id === selectedStudent 
          ? { ...s, paidFees: newPaidFees } 
          : s
      ));

      setShowPayModal(false);
      setPaymentAmount('');
      setPaymentNote('');
      setSelectedStudent('');
      alert(`Payment of ₹${amount.toLocaleString()} recorded successfully.`);
    } catch (err: any) {
      console.error('Payment error:', err);
      alert(`Failed to record payment: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (s: typeof students[0]) => {
    const due = s.totalFees - s.paidFees;
    if (due === 0) return <Badge color="green">Paid Full</Badge>;
    if (s.paidFees > 0) return <Badge color="orange">Partial</Badge>;
    return <Badge color="red">Unpaid</Badge>;
  };

  const feePercent = (s: typeof students[0]) => Math.min(Math.round((s.paidFees / s.totalFees) * 100), 100);

  const studentPayments = (studentId: string) =>
    feePayments.filter(p => p.studentId === studentId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance & Fees"
        subtitle="Track revenue and student payment status"
        action={{
          label: 'Record Payment',
          icon: <Plus size={18} />,
          onClick: () => setShowPayModal(true),
          color: 'green'
        }}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total Collected" value={`₹${(totalCollected / 100000).toFixed(1)}L`}
          icon={<CheckCircle2 size={20} className="text-green-600" />} color="text-green-700" bgColor="bg-green-50"
          subtitle={`${paidFull} fully paid`} />
        <StatCard title="Total Pending" value={`₹${(totalDue / 100000).toFixed(1)}L`}
          icon={<AlertCircle size={20} className="text-red-600" />} color="text-red-700" bgColor="bg-red-50"
          subtitle="Pending collection" />
        <StatCard title="Collection Rate" value={`${Math.round((totalCollected / totalRevenue) * 100)}%`}
          icon={<TrendingUp size={20} className="text-blue-600" />} color="text-blue-700" bgColor="bg-blue-50"
          subtitle="Of total revenue" />
        <StatCard title="Monthly Avg" value={`₹${((totalCollected / 5) / 1000).toFixed(0)}K`}
          icon={<IndianRupee size={20} className="text-purple-600" />} color="text-purple-700" bgColor="bg-purple-50"
          subtitle="Last 5 months" />
      </div>

      {/* Monthly Chart */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-3">Monthly Collections</h3>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v / 1000}K`} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px' }} formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Collected']} />
            <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'All' },
          { key: 'paid', label: '✅ Paid' },
          { key: 'partial', label: '⚠️ Partial' },
          { key: 'due', label: '🔴 Unpaid' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilterStatus(key as any)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === key ? 'bg-green-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search students..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-400 text-slate-800" />
      </div>

      {/* Student List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredStudents.map(student => {
          const payments = studentPayments(student.id);
          const due = student.totalFees - student.paidFees;

          return (
            <div key={student.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{student.name}</p>
                    <p className="text-xs text-slate-400">{student.studentId} • {student.category} {student.stream}</p>
                  </div>
                </div>
                {getStatusBadge(student)}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div className="bg-slate-50 rounded-lg p-2 text-center">
                  <p className="text-slate-400">Total</p>
                  <p className="font-bold text-slate-700">₹{(student.totalFees / 1000).toFixed(0)}K</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-green-500">Paid</p>
                  <p className="font-bold text-green-600">₹{(student.paidFees / 1000).toFixed(0)}K</p>
                </div>
                <div className={`rounded-lg p-2 text-center ${due > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                  <p className={due > 0 ? 'text-red-400' : 'text-green-400'}>Due</p>
                  <p className={`font-bold ${due > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(due / 1000).toFixed(0)}K</p>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Payment Progress</span>
                  <span>{feePercent(student)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${feePercent(student) >= 100 ? 'bg-green-500' : feePercent(student) >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${feePercent(student)}%` }}
                  />
                </div>
              </div>

              {/* Payment History */}
              {payments.length > 0 && (
                <div className="border-t border-slate-50 pt-2">
                  <p className="text-xs text-slate-400 mb-1.5">Payment History</p>
                  <div className="space-y-1">
                    {payments.slice(0, 2).map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">{format(new Date(p.date), 'dd MMM')} • {p.mode}</span>
                        <span className="font-semibold text-green-600">+₹{p.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {payments.length > 2 && <p className="text-xs text-slate-400">+{payments.length - 2} more payments</p>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Payment Modal */}
      <Modal isOpen={showPayModal} onClose={() => setShowPayModal(false)} title="Record Fee Payment">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Select Student</label>
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 text-slate-800">
              <option value="">-- Select Student --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.studentId}) - Due: ₹{(s.totalFees - s.paidFees).toLocaleString()}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Amount (₹)</label>
            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 text-slate-800" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Payment Mode</label>
            <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 text-slate-800">
              <option>Online</option>
              <option>Cash</option>
              <option>Cheque</option>
              <option>UPI</option>
              <option>Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Note (Optional)</label>
            <input type="text" value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
              placeholder="e.g. First installment"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-green-400 text-slate-800" />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowPayModal(false)}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={handleAddPayment}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-semibold">
              Record Payment
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
