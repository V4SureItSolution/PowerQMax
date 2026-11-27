import React, { useState } from "react";
import { FaBuilding, FaListAlt, FaChartLine, FaExchangeAlt, FaMoneyBillWave } from "react-icons/fa";
import ProjectList      from "./ProjectList";
import BOQEditor        from "./BOQEditor";
import ProgressClaimList from "./ProgressClaimList";
import VariationOrders  from "./VariationOrders";
import PaymentSummary   from "./PaymentSummary";
import { T } from "./boqUtils";

const TABS = [
  { key: "boq",        label: "BOQ",             icon: <FaListAlt /> },
  { key: "claims",     label: "Progress Claims",  icon: <FaChartLine /> },
  { key: "variations", label: "Variation Orders", icon: <FaExchangeAlt /> },
];

const BOQModule = () => {
  const [project, setProject]   = useState(null);   // selected project
  const [tab, setTab]           = useState("boq");
  const [summaryData, setSummaryData] = useState(null); // { claim }

  const selectProject = (p) => { setProject(p); setTab("boq"); setSummaryData(null); };
  const backToProjects = () => { setProject(null); setSummaryData(null); };

  const viewSummary = (claim) => { setSummaryData(claim); };
  const backFromSummary = () => setSummaryData(null);

  return (
    <div style={T.page}>
      {/* Page Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <FaBuilding style={{ color: "#3b82f6", fontSize: 22 }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>BOQ & Progress Claims</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Bill of Quantities · Progress Claims · Variation Orders</div>
        </div>
      </div>

      {/* No project selected → show project list */}
      {!project && <ProjectList onSelectProject={selectProject} />}

      {/* Project selected */}
      {project && (
        <>
          {/* Project breadcrumb + tab bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={backToProjects} style={{ ...T.btn("#334155"), fontSize: 11 }}>
              ← Projects
            </button>
            <span style={{ color: "#475569", fontSize: 13 }}>›</span>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{project.projectName}</span>
            <span style={{ color: "#475569", fontSize: 11 }}>({project.projectNumber})</span>
          </div>

          {/* Tabs */}
          {!summaryData && (
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {TABS.map(t => (
                <button key={t.key} style={T.tab(tab === t.key)} onClick={() => setTab(t.key)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab content */}
          {summaryData ? (
            <PaymentSummary
              project={project}
              claim={summaryData}
              onBack={backFromSummary}
            />
          ) : tab === "boq" ? (
            <BOQEditor project={project} onBack={backToProjects} />
          ) : tab === "claims" ? (
            <ProgressClaimList project={project} onViewSummary={viewSummary} />
          ) : (
            <VariationOrders project={project} />
          )}
        </>
      )}
    </div>
  );
};

export default BOQModule;
