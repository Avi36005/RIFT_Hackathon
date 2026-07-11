import { useState, useEffect, useCallback, useMemo } from 'react';
import './index.css';
import Window from './aqua/Window';
import MenuBar from './aqua/MenuBar';
import Dock from './aqua/Dock';
import GelButton from './aqua/GelButton';
import SignIn from './windows/SignIn';
import BuddyList from './windows/BuddyList';
import ChatWindow from './windows/ChatWindow';
import VerifySheet from './windows/VerifySheet';
import WarningMeter from './windows/WarningMeter';
import GetInfo from './windows/GetInfo';
import StatusMenu from './windows/StatusMenu';
import { api } from './lib/api';
import { useGlobalWS, sendIM } from './lib/ws';
import { createSounds } from './lib/sounds';

/**
 * Agent Messenger — Mac OS X Aqua desktop shell.
 * Modern engine (real Ed25519 handshake, gated LLM negotiation, moderation),
 * Aqua paint (brushed-metal windows, gel bubbles, magnifying Dock, menu bar).
 *
 * State machine + WS handling + demo triggers are preserved from the prior app;
 * the entire visual layer is rebuilt as Aqua/iChat.
 */
export default function App() {
  const [agents, setAgents] = useState([]);
  const [buddies, setBuddies] = useState([]);
  const [offlineBuddies, setOfflineBuddies] = useState([]);
  const [signedInAs, setSignedInAs] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [deals, setDeals] = useState({});               // dealId/winId -> {status, terms, messages, partner}
  const [verifyTarget, setVerifyTarget] = useState(null); // {from, to, imposter, attachTo}
  const [mute, setMute] = useState(false);
  const [selectedBuddy, setSelectedBuddy] = useState(null); // for the Buddies menu

  // ---- Window manager ----
  const signonWindow = {
    id: 'signon',
    title: 'Agent Messenger',
    open: true,
    minimized: false,
    defaultPosition: { x: 0, y: 0 },   // centered via transform at render
    defaultSize: { width: 270, height: 360 },
    resizable: false,
    center: true,
  };
  const [windows, setWindows] = useState({ signon: signonWindow });
  const [focusedId, setFocusedId] = useState('signon');

  const play = useMemo(() => createSounds(() => mute), [mute]);

  // ---------------------------------------------------------------------------
  // Data refresh
  // ---------------------------------------------------------------------------
  const refreshAgentList = useCallback(async () => {
    try {
      const res = await api.listAgents();
      setAgents(res.agents.map((a) => a.screen_name));
    } catch (_) {}
  }, []);

  const refreshBuddies = useCallback(async (currentName) => {
    if (!currentName) return;
    try {
      const res = await api.getBuddies(currentName);
      const list = res.buddies || [];
      setBuddies(list.filter((b) => b.status !== 'offline'));
      setOfflineBuddies(list.filter((b) => b.status === 'offline'));
    } catch (_) {}
  }, []);

  useEffect(() => { refreshAgentList(); }, [refreshAgentList]);

  useEffect(() => {
    if (signedInAs) {
      refreshBuddies(signedInAs);
      api.getAgent(signedInAs).then(setCurrentUserData).catch(() => {});
    }
  }, [signedInAs, refreshBuddies]);

  // ---------------------------------------------------------------------------
  // Window management
  // ---------------------------------------------------------------------------
  const focusWindow = useCallback((id) => setFocusedId(id), []);

  const closeWindow = useCallback((id) => {
    setWindows((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const minimizeWindow = useCallback((id) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], minimized: true } }));
  }, []);

  const restoreWindow = useCallback((id) => {
    setWindows((prev) => ({ ...prev, [id]: { ...prev[id], minimized: false } }));
    setFocusedId(id);
  }, []);

  const openWindow = useCallback((win) => {
    setWindows((prev) => ({ ...prev, [win.id]: { ...win, open: true, minimized: false } }));
    setFocusedId(win.id);
  }, []);

  // ---------------------------------------------------------------------------
  // WebSocket events
  // ---------------------------------------------------------------------------
  const onWsEvent = useCallback((data) => {
    switch (data.type) {
      case 'presence':
        if (signedInAs) refreshBuddies(signedInAs);
        break;
      case 'warning':
        if (signedInAs) {
          refreshBuddies(signedInAs);
          if (data.screen_name === signedInAs) {
            api.getAgent(signedInAs).then(setCurrentUserData).catch(() => {});
            play('warn');
          }
        }
        break;
      case 'verification_complete':
        if (signedInAs) { refreshBuddies(signedInAs); play('verify'); }
        break;
      case 'deal_start':
        if (data.initiator === signedInAs || data.counterparty === signedInAs) {
          const partner = data.initiator === signedInAs ? data.counterparty : data.initiator;
          const winId = `chat-${partner}`;
          setDeals((prev) => ({
            ...prev,
            [data.deal_id]: { status: 'negotiating', messages: [], partner },
          }));
          openWindow({
            id: winId,
            title: `${partner}`,
            defaultPosition: { x: 360, y: 80 },
            defaultSize: { width: 460, height: 440 },
            resizable: true,
            chatBuddy: { screenName: partner },
            dealId: data.deal_id,
          });
        }
        break;
      case 'deal_message':
        setDeals((prev) => {
          const deal = prev[data.deal_id];
          if (!deal) return prev;
          play('message');
          return {
            ...prev,
            [data.deal_id]: {
              ...deal,
              messages: [...deal.messages, { sender: data.sender, text: data.text, ts: data.timestamp }],
            },
          };
        });
        break;
      case 'deal_complete':
        setDeals((prev) => {
          const deal = prev[data.deal_id];
          if (!deal) return prev;
          return {
            ...prev,
            [data.deal_id]: {
              ...deal,
              status: data.status,
              terms: data.terms,
              messages: data.transcript || deal.messages,
            },
          };
        });
        break;
      case 'im':
        if (data.to === signedInAs) {
          const winId = `chat-${data.from}`;
          openWindow({
            id: winId,
            title: `${data.from}`,
            defaultPosition: { x: 400, y: 120 },
            defaultSize: { width: 440, height: 420 },
            resizable: true,
            chatBuddy: { screenName: data.from },
          });
          setDeals((prev) => {
            const current = prev[winId] || { messages: [] };
            play('message');
            return {
              ...prev,
              [winId]: {
                ...current,
                messages: [...current.messages, { sender: data.from, text: data.text, ts: data.timestamp }],
              },
            };
          });
        }
        break;
      case 'im_sent':
        if (data.from === signedInAs) {
          const winId = `chat-${data.to}`;
          setDeals((prev) => {
            const current = prev[winId] || { messages: [] };
            return {
              ...prev,
              [winId]: {
                ...current,
                messages: [...current.messages, { sender: signedInAs, text: data.text, ts: data.timestamp }],
              },
            };
          });
        }
        break;
      default:
        break;
    }
  }, [signedInAs, refreshBuddies, play, openWindow]);

  useGlobalWS({ signedInAs, onEvent: onWsEvent });

  // ---------------------------------------------------------------------------
  // Sign On / Off
  // ---------------------------------------------------------------------------
  const handleSignOn = useCallback(async (screenName) => {
    try {
      await api.setPresence(screenName, 'online');
      setSignedInAs(screenName);
      play('door_open');

      closeWindow('signon');
      openWindow({
        id: 'buddylist',
        title: 'Buddy List',
        defaultPosition: { x: 40, y: 50 },
        defaultSize: { width: 240, height: 460 },
        resizable: true,
      });
    } catch (err) {
      alert(`Sign on failed: ${err.message}`);
    }
  }, [closeWindow, openWindow, play]);

  const handleSignOff = useCallback(async () => {
    if (!signedInAs) return;
    try { await api.setPresence(signedInAs, 'offline'); } catch (_) {}
    setSignedInAs(null);
    setDeals({});
    setWindows({ signon: signonWindow });
    setFocusedId('signon');
  }, [signedInAs]);

  // ---------------------------------------------------------------------------
  // Actions: IM, Verify, Warn, Status, Info
  // ---------------------------------------------------------------------------
  const handleSendIM = useCallback((buddy) => {
    const winId = `chat-${buddy.screenName}`;
    openWindow({
      id: winId,
      title: `${buddy.screenName}`,
      defaultPosition: { x: 320 + Math.random() * 40, y: 70 + Math.random() * 30 },
      defaultSize: { width: 460, height: 440 },
      resizable: true,
      chatBuddy: buddy,
    });
  }, [openWindow]);

  // Verify runs as a SHEET attached to the chat window (or buddy list fallback).
  const handleVerify = useCallback((buddy, imposter = false) => {
    const attachTo = windows[`chat-${buddy.screenName}`] ? `chat-${buddy.screenName}` : 'buddylist';
    setVerifyTarget({ from: signedInAs, to: buddy.screenName, imposter, attachTo });
  }, [signedInAs, windows]);

  const handleWarnAction = useCallback((buddy) => {
    openWindow({
      id: `warn-${buddy.screenName}`,
      title: `Warn ${buddy.screenName}`,
      defaultPosition: { x: 360, y: 140 },
      defaultSize: { width: 320, height: 360 },
      resizable: false,
      warnBuddy: buddy,
    });
  }, [openWindow]);

  const executeWarn = useCallback(async (subjectName, reason, weight) => {
    await api.warnAgent(signedInAs, subjectName, reason, weight);
    closeWindow(`warn-${subjectName}`);
  }, [signedInAs, closeWindow]);

  // Get Info opens a real Aqua inspector window (no more alert()).
  const handleGetInfo = useCallback((buddy) => {
    openWindow({
      id: `info-${buddy.screenName}`,
      title: `Info: ${buddy.screenName}`,
      defaultPosition: { x: 380, y: 120 },
      defaultSize: { width: 320, height: 340 },
      resizable: false,
      infoBuddy: buddy,
    });
  }, [openWindow]);

  const handleStatusOpen = useCallback(() => {
    openWindow({
      id: 'status',
      title: 'My Status',
      defaultPosition: { x: 300, y: 150 },
      defaultSize: { width: 300, height: 260 },
      resizable: false,
    });
  }, [openWindow]);

  const handleStatusSave = useCallback(async (status, awayMessage) => {
    await api.setPresence(signedInAs, status, awayMessage);
    api.getAgent(signedInAs).then(setCurrentUserData).catch(() => {});
    closeWindow('status');
  }, [signedInAs, closeWindow]);

  const handleDirectIMSend = useCallback((buddyName, text) => {
    sendIM(signedInAs, buddyName, text);
  }, [signedInAs]);

  const handleStartNegotiation = useCallback(async (buddyName) => {
    try {
      await api.startDeal(signedInAs, buddyName, 'buy_api_access');
    } catch (err) {
      alert(`Gated Deal Refused:\n${err.message}`);
    }
  }, [signedInAs]);

  // ---------------------------------------------------------------------------
  // Demo triggers
  // ---------------------------------------------------------------------------
  const handleSeed = async () => {
    try {
      await api.seedDemo();
      await refreshAgentList();
      if (signedInAs) refreshBuddies(signedInAs);
      alert('Demo agents seeded!');
    } catch (err) {
      alert(`Seeding failed: ${err.message}`);
    }
  };

  const handleReset = async () => {
    try {
      await api.resetDemo();
      await refreshAgentList();
      if (signedInAs) handleSignOff();
      alert('Database reset & re-seeded!');
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  const handleRunFullDemo = async () => {
    try {
      await api.runFullDemo();
      if (!signedInAs) await handleSignOn('AgentBuyer42');
    } catch (err) {
      alert(`Demo runner failed: ${err.message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // Dock items
  // ---------------------------------------------------------------------------
  const dockItems = [
    { id: 'messenger', label: 'Agent Messenger', emoji: '💬', color: 'linear-gradient(180deg,#cfe6ff,#4a90e2 60%,#1c5fcb)' },
    { id: 'buddies', label: 'Buddy List', emoji: '👥', color: 'linear-gradient(180deg,#d8f5dd,#5fd07a 60%,#1f9c3c)' },
    { id: 'keys', label: 'Identity', emoji: '🔑', color: 'linear-gradient(180deg,#ffe6b0,#f0b030 60%,#a8730b)' },
    { id: 'warn', label: 'Moderation', emoji: '⚠️', color: 'linear-gradient(180deg,#ffd0cc,#ff6a5a 60%,#c2302a)' },
  ];
  const runningIds = Object.keys(windows)
    .filter((id) => !windows[id].minimized)
    .map((id) => (id === 'signon' || id === 'buddylist' ? 'messenger' : id.startsWith('chat-') ? 'messenger' : id.startsWith('warn') ? 'warn' : id.startsWith('info') ? 'keys' : 'messenger'));

  const onDockClick = (it) => {
    if (it.id === 'messenger') {
      if (signedInAs) {
        if (windows.buddylist?.minimized) restoreWindow('buddylist');
        else if (!windows.buddylist) openWindow({ id: 'buddylist', title: 'Buddy List', defaultPosition: { x: 40, y: 50 }, defaultSize: { width: 240, height: 460 }, resizable: true });
        else focusWindow('buddylist');
      } else if (!windows.signon) {
        openWindow(signonWindow);
      } else {
        focusWindow('signon');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Buddies menu (acts on the selected buddy)
  // ---------------------------------------------------------------------------
  const buddiesMenu = !selectedBuddy ? [
    { label: 'Select a buddy first', disabled: true },
  ] : [
    { label: `💬 Send Message — ${selectedBuddy.screenName}`, onClick: () => handleSendIM(selectedBuddy), disabled: !signedInAs },
    { label: `🔑 Verify Identity — ${selectedBuddy.screenName}`, onClick: () => handleVerify(selectedBuddy, false), disabled: !signedInAs },
    { sep: true },
    { label: `ℹ️ Get Info — ${selectedBuddy.screenName}`, onClick: () => handleGetInfo(selectedBuddy), disabled: !signedInAs },
    { label: `⚠️ Warn — ${selectedBuddy.screenName}`, onClick: () => handleWarnAction(selectedBuddy), disabled: !signedInAs },
  ];

  const windowList = Object.values(windows).filter((w) => w.open !== false);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="aqua-desktop">
      <MenuBar
        buddiesMenu={buddiesMenu}
        onRunDemo={handleRunFullDemo}
        onSeed={handleSeed}
        onReset={handleReset}
        onToggleSound={() => setMute(!mute)}
        soundOn={!mute}
      />

      {/* Desktop icons (original homages) */}
      <div style={{ position: 'absolute', top: 40, left: 16, display: 'flex', flexDirection: 'column', gap: 18, zIndex: 5 }}>
        <DesktopIcon
          label="Agent Messenger"
          glyph="💬"
          onClick={() => {
            if (signedInAs) {
              if (windows.buddylist?.minimized) restoreWindow('buddylist');
              else if (!windows.buddylist) openWindow({ id: 'buddylist', title: 'Buddy List', defaultPosition: { x: 40, y: 50 }, defaultSize: { width: 240, height: 460 }, resizable: true });
              else focusWindow('buddylist');
            } else if (!windows.signon) {
              openWindow(signonWindow);
            } else {
              focusWindow('signon');
            }
          }}
        />
      </div>

      {/* Floating demo palette (period-accurate brushed-metal) */}
      <div className="aqua-demo-panel">
        <div className="adp-title">🕹️ Demo Control</div>
        <div className="adp-row">
          <GelButton variant="primary" style={{ width: '100%' }} onClick={handleRunFullDemo}>⚡ Run Demo</GelButton>
          <GelButton style={{ width: '100%' }} onClick={handleSeed}>🌱 Seed Agents</GelButton>
          <GelButton style={{ width: '100%' }} onClick={handleReset}>🔄 Reset DB</GelButton>
        </div>
        <div className="adp-sep" />
        <div style={{ fontSize: 10, fontWeight: 700 }} className="embossed">Manual Verify</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <GelButton
            style={{ flex: 1, padding: '3px' }}
            disabled={!signedInAs}
            onClick={() => handleVerify({ screenName: 'DataSeller_X' }, false)}
          >✓ Prove</GelButton>
          <GelButton
            style={{ flex: 1, padding: '3px' }}
            disabled={!signedInAs}
            onClick={() => handleVerify({ screenName: 'DataSeller_X' }, true)}
          >✗ Imposter</GelButton>
        </div>
        <div className="adp-sep" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10 }} className="dim">Sound</span>
          <GelButton style={{ padding: '2px 10px' }} onClick={() => setMute(!mute)}>
            {mute ? '🔇 Off' : '🔊 On'}
          </GelButton>
        </div>
      </div>

      {/* All windows */}
      {Object.values(windows).map((win) => {
        const isChat = win.id.startsWith('chat-');
        const isWarn = win.id.startsWith('warn-');
        const isInfo = win.id.startsWith('info-');

        // Verify sheet (attached to a window body) — render only into the attach target.
        const showVerifySheet = verifyTarget && verifyTarget.attachTo === win.id;

        // Center the signon window.
        const centeredPos = win.center
          ? { x: Math.max(20, (window.innerWidth - (win.defaultSize?.width || 270)) / 2), y: 90 }
          : win.defaultPosition;

        return (
          <Window
            key={win.id}
            id={win.id}
            title={win.title}
            defaultPosition={centeredPos}
            defaultSize={win.defaultSize}
            resizable={win.resizable}
            focused={focusedId === win.id}
            minimized={win.minimized}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onFocus={() => focusWindow(win.id)}
            sheet={showVerifySheet && verifyTarget ? (
              <VerifySheet
                fromName={verifyTarget.from}
                toName={verifyTarget.to}
                imposter={verifyTarget.imposter}
                onComplete={(ok) => { if (ok && signedInAs) refreshBuddies(signedInAs); }}
                onClose={() => { setVerifyTarget(null); if (signedInAs) refreshBuddies(signedInAs); }}
                api={api}
              />
            ) : null}
          >
            {win.id === 'signon' && (
              <SignIn agents={agents} onSignOn={handleSignOn} />
            )}

            {win.id === 'buddylist' && (
              <BuddyList
                currentUser={signedInAs}
                currentStatus={currentUserData?.status || 'online'}
                currentAwayMessage={currentUserData?.away_message || ''}
                buddies={buddies}
                offlineBuddies={offlineBuddies}
                onSendIM={handleSendIM}
                onVerify={handleVerify}
                onWarn={handleWarnAction}
                onGetInfo={handleGetInfo}
                onStatusOpen={handleStatusOpen}
              />
            )}

            {isChat && (
              <ChatWindow
                buddyName={win.chatBuddy?.screenName}
                currentUser={signedInAs}
                messages={win.dealId ? (deals[win.dealId]?.messages || []) : (deals[win.id]?.messages || [])}
                dealId={win.dealId}
                dealStatus={win.dealId ? (deals[win.dealId]?.status || 'negotiating') : null}
                dealTerms={win.dealId ? (deals[win.dealId]?.terms || null) : null}
                verified={[...buddies, ...offlineBuddies].find((b) => b.screenName === win.chatBuddy?.screenName)?.verified || false}
                onSendMessage={(text) => handleDirectIMSend(win.chatBuddy?.screenName, text)}
                onStartNegotiation={() => handleStartNegotiation(win.chatBuddy?.screenName)}
                onVerify={() => handleVerify({ screenName: win.chatBuddy?.screenName }, false)}
                warningLevel={currentUserData?.warning_level || 0}
              />
            )}

            {isWarn && (
              <WarningMeter
                screenName={win.warnBuddy?.screenName}
                warningLevel={win.warnBuddy?.warningLevel || 0}
                onWarn={executeWarn}
                onClose={() => closeWindow(win.id)}
              />
            )}

            {isInfo && (
              <GetInfo
                screenName={win.infoBuddy?.screenName}
                initialWarningLevel={win.infoBuddy?.warningLevel || 0}
                onWarn={(name) => {
                  closeWindow(win.id);
                  handleWarnAction({ screenName: name, warningLevel: win.infoBuddy?.warningLevel || 0 });
                }}
                onClose={() => closeWindow(win.id)}
              />
            )}

            {win.id === 'status' && (
              <StatusMenu
                currentStatus={currentUserData?.status || 'online'}
                currentMessage={currentUserData?.away_message || ''}
                onSave={handleStatusSave}
                onClose={() => closeWindow('status')}
              />
            )}
          </Window>
        );
      })}

      {/* The Dock */}
      <Dock items={dockItems} runningIds={runningIds} onItemClick={onDockClick} />
    </div>
  );
}

/* ---- Desktop icon ---- */
function DesktopIcon({ label, glyph, onClick }) {
  return (
    <div className="desktop-icon" onClick={onClick} onDoubleClick={onClick}>
      <div className="di-glyph">{glyph}</div>
      <div className="di-label">{label}</div>
    </div>
  );
}
