import { useState, useCallback, useMemo } from 'react';
import { predictGoalDiff } from '../utils/model.js';
import { flag } from '../utils/flags.js';

// ── Real 2026 WC groups (FIFA draw, Dec 5 2025) ────────────────────────────────
export const GROUPS = {
  A: ['Mexico',        'South Africa',           'South Korea', 'Czechia'],
  B: ['Canada',        'Bosnia and Herzegovina', 'Qatar',       'Switzerland'],
  C: ['Brazil',        'Morocco',                'Haiti',       'Scotland'],
  D: ['United States', 'Paraguay',               'Australia',   'Turkey'],
  E: ['Germany',       'Curacao',                'Ivory Coast', 'Ecuador'],
  F: ['Netherlands',   'Japan',                  'Sweden',      'Tunisia'],
  G: ['Belgium',       'Egypt',                  'Iran',        'New Zealand'],
  H: ['Spain',         'Cape Verde',             'Saudi Arabia','Uruguay'],
  I: ['France',        'Senegal',                'Iraq',        'Norway'],
  J: ['Argentina',     'Algeria',                'Austria',     'Jordan'],
  K: ['Portugal',      'DR Congo',               'Uzbekistan',  'Colombia'],
  L: ['England',       'Croatia',                'Ghana',       'Panama'],
};

const ALL_48 = Object.values(GROUPS).flat();

function slotTeams(letters) {
  if (!letters?.length) return ALL_48;
  return [...new Set(letters.flatMap(g => GROUPS[g] || []))];
}

// ── Official R32 bracket (M73-M88) ────────────────────────────────────────────
const R32_DEF = [
  { id:'r32_0',  fifa:'M73', aDesc:'2nd Group A', aG:['A'], bDesc:'2nd Group B', bG:['B'] },
  { id:'r32_1',  fifa:'M74', aDesc:'1st Group E', aG:['E'], bDesc:'3rd A/B/C/D/F', bG:['A','B','C','D','F'] },
  { id:'r32_2',  fifa:'M75', aDesc:'1st Group F', aG:['F'], bDesc:'2nd Group C',   bG:['C'] },
  { id:'r32_3',  fifa:'M76', aDesc:'1st Group C', aG:['C'], bDesc:'2nd Group F',   bG:['F'] },
  { id:'r32_4',  fifa:'M77', aDesc:'1st Group I', aG:['I'], bDesc:'3rd C/D/F/G/H', bG:['C','D','F','G','H'] },
  { id:'r32_5',  fifa:'M78', aDesc:'2nd Group E', aG:['E'], bDesc:'2nd Group I',   bG:['I'] },
  { id:'r32_6',  fifa:'M79', aDesc:'1st Group A', aG:['A'], bDesc:'3rd C/E/F/H/I', bG:['C','E','F','H','I'] },
  { id:'r32_7',  fifa:'M80', aDesc:'1st Group L', aG:['L'], bDesc:'3rd E/H/I/J/K', bG:['E','H','I','J','K'] },
  { id:'r32_8',  fifa:'M81', aDesc:'1st Group D', aG:['D'], bDesc:'3rd B/E/F/I/J', bG:['B','E','F','I','J'] },
  { id:'r32_9',  fifa:'M82', aDesc:'1st Group G', aG:['G'], bDesc:'3rd A/E/H/I/J', bG:['A','E','H','I','J'] },
  { id:'r32_10', fifa:'M83', aDesc:'2nd Group K', aG:['K'], bDesc:'2nd Group L',   bG:['L'] },
  { id:'r32_11', fifa:'M84', aDesc:'1st Group H', aG:['H'], bDesc:'2nd Group J',   bG:['J'] },
  { id:'r32_12', fifa:'M85', aDesc:'1st Group B', aG:['B'], bDesc:'3rd E/F/G/I/J', bG:['E','F','G','I','J'] },
  { id:'r32_13', fifa:'M86', aDesc:'1st Group J', aG:['J'], bDesc:'2nd Group H',   bG:['H'] },
  { id:'r32_14', fifa:'M87', aDesc:'1st Group K', aG:['K'], bDesc:'3rd D/E/I/J/L', bG:['D','E','I','J','L'] },
  { id:'r32_15', fifa:'M88', aDesc:'2nd Group D', aG:['D'], bDesc:'2nd Group G',   bG:['G'] },
];

const FEED = {
  r16_0:['r32_0','r32_1'],  r16_1:['r32_2','r32_3'],
  r16_2:['r32_4','r32_5'],  r16_3:['r32_6','r32_7'],
  r16_4:['r32_8','r32_9'],  r16_5:['r32_10','r32_11'],
  r16_6:['r32_12','r32_13'],r16_7:['r32_14','r32_15'],
  qf_0:['r16_0','r16_1'],   qf_1:['r16_2','r16_3'],
  qf_2:['r16_4','r16_5'],   qf_3:['r16_6','r16_7'],
  sf_0:['qf_0','qf_1'],     sf_1:['qf_2','qf_3'],
  final:['sf_0','sf_1'],
};

const LEFT_R32  = R32_DEF.slice(0, 8).map(m => m.id);
const RIGHT_R32 = R32_DEF.slice(8).map(m => m.id);

const ROUND_OPTIONS = [
  { id:'r32', label:'Round of 32',   slots:32 },
  { id:'r16', label:'Round of 16',   slots:16 },
  { id:'qf',  label:'Quarterfinals', slots:8  },
  { id:'sf',  label:'Semifinals',    slots:4  },
];

function modelWinner(a, b, model) {
  if (!a || !b) return null;
  return predictGoalDiff(a, b, true, model) >= 0 ? a : b;
}

// ── Team slot row ─────────────────────────────────────────────────────────────
function SlotRow({ team, label, groups, onPick, isWin, isOut, takenTeams }) {
  const base    = slotTeams(groups);
  // Remove teams already used elsewhere (but keep the current team selectable)
  const options = base.filter(t => t === team || !takenTeams.has(t)).sort();

  return (
    <div className={`match-slot ${isWin ? 'match-slot-winner' : isOut ? 'match-slot-loser' : ''}`}>
      {team
        ? <span className="text-base flex-shrink-0 leading-none">{flag(team)}</span>
        : <span className="w-4 flex-shrink-0" />
      }
      <select
        value={team}
        onChange={e => onPick(e.target.value)}
        className="bg-transparent text-xs text-ink w-full focus:outline-none min-w-0 truncate"
        title={team || label}
      >
        <option value="">{label || '— pick —'}</option>
        {options.map(t => (
          <option key={t} value={t}>{flag(t)} {t}</option>
        ))}
      </select>
      {isWin && <span className="text-xs flex-shrink-0" style={{ color:'oklch(0.52 0.14 145)' }}>✓</span>}
    </div>
  );
}

// ── Pick-based match card (R32 with group restrictions, or free-pick) ──────────
function MatchCard({ matchId, teamA, teamB, labelA, labelB, groupsA, groupsB,
                     winner, onPickA, onPickB, model, takenTeams }) {
  const auto   = modelWinner(teamA, teamB, model);
  const result = winner || auto;

  return (
    <div className="match-card">
      <div className="px-2 py-0.5 bg-subtle flex items-center justify-between">
        <span className="text-2xs text-ghost font-mono">{matchId.toUpperCase().replace('_',' ')}</span>
      </div>
      <div className="divide-y divide-line">
        <SlotRow team={teamA} label={labelA} groups={groupsA}
                 onPick={onPickA} isWin={result === teamA && !!teamA}
                 isOut={!!result && result !== teamA && !!teamA}
                 takenTeams={takenTeams} />
        <SlotRow team={teamB} label={labelB} groups={groupsB}
                 onPick={onPickB} isWin={result === teamB && !!teamB}
                 isOut={!!result && result !== teamB && !!teamB}
                 takenTeams={takenTeams} />
      </div>
      {result && (
        <div className="px-2.5 py-1 flex items-center gap-1.5">
          <span className="text-base leading-none">{flag(result)}</span>
          <span className="text-2xs truncate" style={{ color:'oklch(0.52 0.14 145)' }}>{result} →</span>
        </div>
      )}
    </div>
  );
}

// ── Read-only card showing advancing teams ────────────────────────────────────
function AdvanceCard({ matchId, getWinner, model }) {
  const [feedA, feedB] = FEED[matchId] || [];
  const teamA  = getWinner(feedA) || '';
  const teamB  = getWinner(feedB) || '';
  const result = modelWinner(teamA, teamB, model);

  const Row = ({ team, isWin }) => (
    <div className={`match-slot ${isWin ? 'match-slot-winner' : result && !isWin && team ? 'match-slot-loser' : ''}`}>
      {team
        ? <span className="text-base flex-shrink-0 leading-none">{flag(team)}</span>
        : <span className="w-4 flex-shrink-0" />
      }
      <span className={`text-xs truncate ${
        isWin ? 'text-ink font-medium' :
        result && !isWin && team ? 'text-ghost line-through' : 'text-ghost italic'
      }`}>
        {team || 'TBD'}
      </span>
      {isWin && <span className="text-xs ml-auto flex-shrink-0" style={{ color:'oklch(0.52 0.14 145)' }}>✓</span>}
    </div>
  );

  return (
    <div className="match-card">
      <div className="px-2 py-0.5 bg-subtle">
        <span className="text-2xs text-ghost font-mono">{matchId.toUpperCase().replace('_',' ')}</span>
      </div>
      <div className="divide-y divide-line">
        <Row team={teamA} isWin={result === teamA && !!teamA} />
        <Row team={teamB} isWin={result === teamB && !!teamB} />
      </div>
      {result && (
        <div className="px-2.5 py-1 flex items-center gap-1.5">
          <span className="text-base leading-none">{flag(result)}</span>
          <span className="text-2xs truncate" style={{ color:'oklch(0.52 0.14 145)' }}>{result} →</span>
        </div>
      )}
    </div>
  );
}

// ── Column wrapper ────────────────────────────────────────────────────────────
function Col({ label, children, center }) {
  return (
    <div className="flex flex-col flex-shrink-0">
      <p className="text-2xs text-ghost font-medium uppercase tracking-wider text-center mb-2 px-1">
        {label}
      </p>
      <div className={`flex flex-col flex-1 gap-3 ${center ? 'justify-center' : 'justify-around'}`}>
        {children}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CustomBracket({ model }) {
  const [startRound, setStartRound] = useState('r32');
  const [picks,      setPicks]      = useState({});

  function pick(matchId, side, team) {
    setPicks(p => ({ ...p, [`${matchId}_${side}`]: team }));
  }
  function getTeam(matchId, side) { return picks[`${matchId}_${side}`] || ''; }

  // All teams currently picked across ALL slots — used to prevent duplicates
  const takenTeams = useMemo(() => {
    return new Set(Object.values(picks).filter(Boolean));
  }, [picks]);

  const getWinner = useCallback((matchId) => {
    if (!matchId) return null;
    if (matchId.startsWith('r32')) {
      return modelWinner(getTeam(matchId,'a'), getTeam(matchId,'b'), model);
    }
    if (startRound === 'r16' && matchId.startsWith('r16')) {
      return modelWinner(getTeam(matchId,'a'), getTeam(matchId,'b'), model);
    }
    if (startRound === 'qf' && matchId.startsWith('qf')) {
      return modelWinner(getTeam(matchId,'a'), getTeam(matchId,'b'), model);
    }
    if (startRound === 'sf' && matchId.startsWith('sf')) {
      return modelWinner(getTeam(matchId,'a'), getTeam(matchId,'b'), model);
    }
    const [feedA, feedB] = FEED[matchId] || [];
    return modelWinner(getWinner(feedA), getWinner(feedB), model);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, startRound, model]);

  function reset() { setPicks({}); }

  const champion = getWinner('final');

  // Helpers for columns
  const AdvCol = ({ label, ids, center }) => (
    <Col label={label} center={center}>
      {ids.map(id => <AdvanceCard key={id} matchId={id} getWinner={getWinner} model={model} />)}
    </Col>
  );

  const FreeCol = ({ label, ids, center }) => (
    <Col label={label} center={center}>
      {ids.map(id => (
        <MatchCard key={id} matchId={id} model={model}
          teamA={getTeam(id,'a')} teamB={getTeam(id,'b')}
          winner={getWinner(id)}
          onPickA={t => pick(id,'a',t)} onPickB={t => pick(id,'b',t)}
          takenTeams={takenTeams}
        />
      ))}
    </Col>
  );

  const R32Col = ({ ids }) => (
    <Col label="Round of 32">
      {ids.map(id => {
        const def = R32_DEF.find(m => m.id === id);
        return (
          <MatchCard key={id} matchId={id} model={model}
            teamA={getTeam(id,'a')} teamB={getTeam(id,'b')}
            labelA={def.aDesc} labelB={def.bDesc}
            groupsA={def.aG} groupsB={def.bG}
            winner={getWinner(id)}
            onPickA={t => pick(id,'a',t)} onPickB={t => pick(id,'b',t)}
            takenTeams={takenTeams}
          />
        );
      })}
    </Col>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">2026 World Cup Bracket</h2>
          <p className="text-dim text-sm mt-0.5">
            Official FIFA draw (Dec 2025). Each team can only appear once. Model advances winners in real time.
          </p>
        </div>
        <button onClick={reset} className="btn-ghost text-xs">Reset</button>
      </div>

      {/* Round selector */}
      <div className="flex flex-wrap gap-2">
        {ROUND_OPTIONS.map(r => (
          <button key={r.id}
            onClick={() => { setStartRound(r.id); reset(); }}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors duration-150 ${
              startRound === r.id
                ? 'border-amber text-base bg-amber'
                : 'border-line text-dim hover:text-ink hover:border-ghost'
            }`}
            style={startRound === r.id ? { color:'oklch(0.12 0.018 245)' } : {}}
          >
            {r.label}
            <span className={`ml-1.5 text-2xs ${startRound === r.id ? 'opacity-60' : 'text-ghost'}`}>
              ({r.slots})
            </span>
          </button>
        ))}
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="panel px-5 py-4 flex items-center gap-4"
             style={{ borderColor:'oklch(0.55 0.09 78 / 0.4)', background:'oklch(0.16 0.03 78 / 0.3)' }}>
          <span className="text-4xl">{flag(champion)}</span>
          <div>
            <p className="text-2xs text-ghost uppercase tracking-wider mb-0.5">🏆 Predicted Champion</p>
            <p className="text-2xl font-bold text-ink">{champion}</p>
          </div>
        </div>
      )}

      {/* Bracket */}
      <div className="overflow-x-auto pb-4 -mx-6 px-6">
        <div className="flex gap-4 min-w-max">
          {startRound === 'r32' && <>
            <R32Col ids={LEFT_R32} />
            <AdvCol label="Round of 16"   ids={['r16_0','r16_1','r16_2','r16_3']} />
            <AdvCol label="Quarterfinals" ids={['qf_0','qf_1']} />
            <AdvCol label="Semifinal"     ids={['sf_0']} center />
            <AdvCol label="⚽ Final"      ids={['final']} center />
            <AdvCol label="Semifinal"     ids={['sf_1']} center />
            <AdvCol label="Quarterfinals" ids={['qf_2','qf_3']} />
            <AdvCol label="Round of 16"   ids={['r16_4','r16_5','r16_6','r16_7']} />
            <R32Col ids={RIGHT_R32} />
          </>}

          {startRound === 'r16' && <>
            <FreeCol label="Round of 16"   ids={['r16_0','r16_1','r16_2','r16_3']} />
            <AdvCol  label="Quarterfinals" ids={['qf_0','qf_1']} />
            <AdvCol  label="Semifinal"     ids={['sf_0']} center />
            <AdvCol  label="⚽ Final"      ids={['final']} center />
            <AdvCol  label="Semifinal"     ids={['sf_1']} center />
            <AdvCol  label="Quarterfinals" ids={['qf_2','qf_3']} />
            <FreeCol label="Round of 16"   ids={['r16_4','r16_5','r16_6','r16_7']} />
          </>}

          {startRound === 'qf' && <>
            <FreeCol label="Quarterfinals" ids={['qf_0','qf_1']} />
            <AdvCol  label="Semifinal"     ids={['sf_0']} center />
            <AdvCol  label="⚽ Final"      ids={['final']} center />
            <AdvCol  label="Semifinal"     ids={['sf_1']} center />
            <FreeCol label="Quarterfinals" ids={['qf_2','qf_3']} />
          </>}

          {startRound === 'sf' && <>
            <FreeCol label="Semifinals" ids={['sf_0','sf_1']} />
            <AdvCol  label="⚽ Final"   ids={['final']} center />
          </>}
        </div>
      </div>

      {/* Group reference */}
      <details className="panel">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink select-none list-none flex justify-between">
          <span>Official Group Draw — Dec 5, 2025</span>
          <span className="text-ghost text-xs">expand</span>
        </summary>
        <div className="border-t border-line px-4 py-4 grid grid-cols-3 md:grid-cols-6 gap-4">
          {Object.entries(GROUPS).map(([letter, teams]) => (
            <div key={letter}>
              <p className="text-2xs font-semibold mb-2" style={{ color:'oklch(0.76 0.13 78)' }}>Group {letter}</p>
              {teams.map(t => (
                <p key={t} className="text-xs text-dim leading-6 flex items-center gap-1.5 truncate">
                  <span>{flag(t)}</span>{t}
                </p>
              ))}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
