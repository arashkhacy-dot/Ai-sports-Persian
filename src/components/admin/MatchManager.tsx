import React, { useState } from 'react';
import { Match, Team, Competition } from '../../types';
import { Trophy, Plus, Users, Shield } from 'lucide-react';
import { toPersianDigits } from '../public/MatchScoreboard';

interface MatchManagerProps {
  matches: Match[];
  teams: Team[];
  competitions: Competition[];
  onCreateMatch: (params: {
    homeTeamId: string;
    awayTeamId: string;
    competitionId: string;
    stadium: string;
    referee: string;
  }) => Promise<void>;
}

export const MatchManager: React.FC<MatchManagerProps> = ({
  matches,
  teams,
  competitions,
  onCreateMatch,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState(teams[0]?.id || '');
  const [awayTeamId, setAwayTeamId] = useState(teams[1]?.id || '');
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id || '');
  const [stadium, setStadium] = useState('ورزشگاه آزادی تهران');
  const [referee, setReferee] = useState('موعود بنیادی‌فر');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onCreateMatch({ homeTeamId, awayTeamId, competitionId, stadium, referee });
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">مدیریت مسابقات و پایگاه اطلاعات تیم‌ها</h3>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs px-3 py-1.5 rounded-xl transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>تعریف مسابقه جدید</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {matches.map((m) => {
          const home = teams.find((t) => t.id === m.homeTeamId);
          const away = teams.find((t) => t.id === m.awayTeamId);
          const comp = competitions.find((c) => c.id === m.competitionId);

          return (
            <div key={m.id} className="p-4 bg-slate-950 rounded-2xl border border-slate-850">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="font-bold text-emerald-400">{comp?.nameFa || 'مسابقه رسمی'}</span>
                <span>ورزشگاه: {m.stadium}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-850">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{home?.nameFa}</span>
                </div>
                <div className="font-mono text-sm font-black text-amber-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  {toPersianDigits(m.homeScore)} - {toPersianDigits(m.awayScore)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">{away?.nameFa}</span>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                <span>داور: {m.referee}</span>
                <span>شناسه مسابقه: {m.id}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Match Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">تعریف مسابقه جدید در سامانه</h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">تیم میزبان</label>
                  <select
                    value={homeTeamId}
                    onChange={(e) => setHomeTeamId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nameFa}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">تیم میهمان</label>
                  <select
                    value={awayTeamId}
                    onChange={(e) => setAwayTeamId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nameFa}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">تورنمنت / رقابت</label>
                <select
                  value={competitionId}
                  onChange={(e) => setCompetitionId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {competitions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameFa}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">استادیوم</label>
                  <input
                    type="text"
                    value={stadium}
                    onChange={(e) => setStadium(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">داور مسابقه</label>
                  <input
                    type="text"
                    value={referee}
                    onChange={(e) => setReferee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-950/40"
                >
                  {loading ? 'در حال ثبت...' : 'ثبت مسابقه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
