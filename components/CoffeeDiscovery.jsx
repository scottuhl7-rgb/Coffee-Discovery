"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";
import COFFEES from "../data/coffees";

const GW = 500;

function countryFill(feat, dk) {
  const c = d3.geoCentroid(feat);
  if (!c || isNaN(c[1])) return dk ? "#2a3a30" : "#5a9a6a";
  const lat = Math.abs(c[1]),
    lng = c[0];
  if (lat > 65) return dk ? "#3a4a5a" : "#c8d4c8";
  if (lat > 50) return dk ? "#263828" : "#72a068";
  if (lat > 35) return dk ? "#283828" : "#6a9a58";
  if (lat > 20 && lng > -20 && lng < 55 && c[1] > 0)
    return dk ? "#3a3828" : "#b8a870";
  if (lat > 20) return dk ? "#283822" : "#5a9848";
  return dk ? "#1a3820" : "#48964a";
}

export default function CoffeeDiscovery() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [worldData, setWorldData] = useState(null);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(0);
  const [zoomCoffee, setZoomCoffee] = useState(null);
  const [nearbyPlaces, setNearbyPlaces] = useState(null);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [userLoc, setUserLoc] = useState(null);

  const cvRef = useRef(null);
  const rotRef = useRef([0, -20, 0]);
  const zoomRef = useRef(0);
  const animRef = useRef(null);
  const idleRef = useRef(null);
  const renderRef = useRef(null);
  const busyRef = useRef(false);

  const dk = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    []
  );

  // Load world topology
  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo) =>
        setWorldData(topojson.feature(topo, topo.objects.countries))
      )
      .catch((e) => console.error("Failed to load world data:", e));

    return () => {
      cancelAnimationFrame(idleRef.current);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUserLoc({ lat: 30.27, lng: -97.74 }) // Default: Austin, TX
      );
    }
  }, []);

  // Globe renderer
  const renderGlobe = useCallback(
    (hIds = [], selId = null, zl = 0) => {
      const cv = cvRef.current;
      if (!cv || !worldData) return;
      const ctx = cv.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      cv.width = GW * dpr;
      cv.height = GW * dpr;
      cv.style.width = GW + "px";
      cv.style.height = GW + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const baseScale = GW / 2 - 4;
      const scale = baseScale * (1 + zl * 6);
      const proj = d3
        .geoOrthographic()
        .translate([GW / 2, GW / 2])
        .scale(scale)
        .rotate(rotRef.current)
        .clipAngle(90);
      const path = d3.geoPath(proj, ctx);
      ctx.clearRect(0, 0, GW, GW);

      // Ocean gradient
      const oG = ctx.createRadialGradient(
        GW / 2 - 50,
        GW / 2 - 70,
        0,
        GW / 2,
        GW / 2,
        GW / 2
      );
      if (dk) {
        oG.addColorStop(0, "#1e4878");
        oG.addColorStop(0.4, "#163a62");
        oG.addColorStop(1, "#081a32");
      } else {
        oG.addColorStop(0, "#5aade0");
        oG.addColorStop(0.3, "#3a92cc");
        oG.addColorStop(1, "#1a5a88");
      }
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = oG;
      ctx.fill();



      // Countries
      worldData.features.forEach((f) => {
        ctx.beginPath();
        path(f);
        ctx.fillStyle = countryFill(f, dk);
        ctx.fill();
        ctx.strokeStyle = dk
          ? "rgba(80,180,120,0.1)"
          : "rgba(255,255,255,0.35)";
        ctx.lineWidth = zl > 0.3 ? 0.8 : 0.3;
        ctx.stroke();
      });

      // Coffee markers
      if (zl < 0.7) {
        const dots =
          hIds.length > 0
            ? COFFEES.filter((c) => hIds.includes(c.id))
            : COFFEES;
        dots.forEach((c) => {
          const pt = proj([c.lng, c.lat]);
          if (!pt) return;
          const dist = d3.geoDistance(
            [c.lng, c.lat],
            [-rotRef.current[0], -rotRef.current[1]]
          );
          if (dist > Math.PI / 2) return;
          const isSel = c.id === selId,
            isRes = hIds.includes(c.id);
          const r = isSel ? 8 : isRes ? 6 : 3;
          if (isSel || isRes) {
            ctx.beginPath();
            ctx.arc(pt[0], pt[1], r + 8, 0, Math.PI * 2);
            ctx.fillStyle = isSel
              ? "rgba(255,170,40,0.12)"
              : "rgba(80,160,255,0.08)";
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
          ctx.fillStyle = isSel
            ? "#f0a020"
            : isRes
              ? dk
                ? "#6ab4f7"
                : "#2563eb"
              : dk
                ? "rgba(255,210,120,0.45)"
                : "rgba(255,190,50,0.5)";
          ctx.fill();
          ctx.strokeStyle = isSel
            ? "rgba(255,200,80,0.7)"
            : "rgba(255,255,255,0.3)";
          ctx.lineWidth = isSel ? 2.5 : 1;
          ctx.stroke();
        });
      }

      // Atmosphere
      if (zl < 0.5) {
        const aG = ctx.createRadialGradient(
          GW / 2,
          GW / 2,
          (GW / 2) * 0.88,
          GW / 2,
          GW / 2,
          (GW / 2) * 1.06
        );
        aG.addColorStop(0, "rgba(80,160,255,0)");
        aG.addColorStop(
          0.5,
          dk ? "rgba(50,100,200,0.04)" : "rgba(80,160,255,0.06)"
        );
        aG.addColorStop(
          1,
          dk ? "rgba(30,70,160,0.1)" : "rgba(60,140,255,0.1)"
        );
        ctx.beginPath();
        ctx.arc(GW / 2, GW / 2, (GW / 2) * 1.06, 0, Math.PI * 2);
        ctx.fillStyle = aG;
        ctx.fill();
      }
    },
    [worldData, dk]
  );

  renderRef.current = renderGlobe;

  // Idle rotation
  useEffect(() => {
    if (!worldData) return;
    let run = true;
    const spin = () => {
      if (!run || busyRef.current) {
        idleRef.current = requestAnimationFrame(spin);
        return;
      }
      rotRef.current = [rotRef.current[0] + 0.1, rotRef.current[1], 0];
      renderRef.current(
        results ? results.map((r) => r.id) : [],
        null,
        0
      );
      idleRef.current = requestAnimationFrame(spin);
    };
    spin();
    return () => {
      run = false;
      cancelAnimationFrame(idleRef.current);
    };
  }, [worldData, results]);

  // Rotate globe (no zoom)
  const rotateTo = useCallback((lat, lng, ids) => {
    busyRef.current = true;
    const from = [...rotRef.current],
      to = [-lng, -lat, 0];
    const interp = d3.interpolate(from, to);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1400);
      rotRef.current = interp(d3.easeCubicInOut(t));
      renderRef.current(ids, null, 0);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else busyRef.current = false;
    };
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  }, []);

  // Zoom into a coffee origin
  function zoomIn(coffee) {
    busyRef.current = true;
    setZoomCoffee(coffee);
    setNearbyPlaces(null);
    const fromRot = [...rotRef.current];
    const toRot = [-coffee.lng, -coffee.lat, 0];
    const rotInterp = d3.interpolate(fromRot, toRot);
    const ids = results ? results.map((r) => r.id) : [coffee.id];
    const start = performance.now();
    const dur = 2400;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = d3.easeCubicInOut(t);
      rotRef.current = rotInterp(Math.min(e * 1.6, 1));
      zoomRef.current = e;
      setZoom(e);
      renderRef.current(ids, coffee.id, e);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else {
        setSelected(coffee);
        busyRef.current = false;
      }
    };
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  }

  // Zoom back out
  function zoomOut() {
    busyRef.current = true;
    const start = performance.now();
    const dur = 1400;
    const ids = results ? results.map((r) => r.id) : [];

    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = d3.easeCubicInOut(t);
      const z = 1 - e;
      zoomRef.current = z;
      setZoom(z);
      renderRef.current(ids, null, z);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
      else {
        setSelected(null);
        setZoomCoffee(null);
        setNearbyPlaces(null);
        busyRef.current = false;
      }
    };
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
  }

  // AI search
  async function searchCoffees() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    setResults(null);
    setZoomCoffee(null);
    setZoom(0);
    zoomRef.current = 0;

    try {
      const summary = COFFEES.map((c) => ({
        id: c.id,
        name: c.name,
        origin: c.origin,
        region: c.region,
        flavor: c.flavor.join(", "),
        body: c.body,
        acidity: c.acidity,
        sweetness: c.sweetness,
        roast: c.roast,
        process: c.process,
        bestBrew: c.bestBrew.join(", "),
        rating: c.rating,
      }));

      const resp = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), coffees: summary }),
      });

      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      const matched = data.results
        .sort((a, b) => b.rating - a.rating)
        .map((r) => ({
          ...COFFEES.find((c) => c.id === r.id),
          rank: r.rank,
          reason: r.reason,
        }))
        .filter(Boolean);

      setResults(matched);
      if (matched[0])
        rotateTo(
          matched[0].lat,
          matched[0].lng,
          matched.map((m) => m.id)
        );
    } catch (e) {
      setError("Search failed — try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Find nearby coffee shops
  async function findNearMe(coffee) {
    if (!userLoc) {
      setNearbyPlaces([]);
      return;
    }
    setPlacesLoading(true);
    try {
      const resp = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: userLoc.lat,
          lng: userLoc.lng,
          query: `specialty coffee ${coffee.origin} single origin roaster`,
        }),
      });
      const data = await resp.json();
      setNearbyPlaces(data.places || []);
    } catch (e) {
      console.error("Places search failed:", e);
      setNearbyPlaces([]);
    } finally {
      setPlacesLoading(false);
    }
  }

  // Derived animation values
  const canvasOpacity = 1 - Math.max(0, (zoom - 0.5) / 0.5);
  const canvasScale = 1 + zoom * 1.8;
  const photoOpacity = Math.max(0, (zoom - 0.35) / 0.65);
  const uiOpacity = 1 - Math.min(1, zoom * 4);
  const profileOpacity = Math.max(0, (zoom - 0.8) / 0.2);
  const showProfile = zoom > 0.75 || selected;
  const sel = selected || zoomCoffee;

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        position: "relative",
        minHeight: zoom > 0.1 ? 750 : "auto",
        overflow: "hidden",
      }}
    >
      {/* Region background photo */}
      {zoomCoffee && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            opacity: photoOpacity,
            borderRadius: 12,
            overflow: "hidden",
            pointerEvents: photoOpacity > 0.5 ? "auto" : "none",
          }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: zoomCoffee.bg }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomCoffee.photo}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.5,
            }}
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.85) 100%)",
            }}
          />
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Search UI */}
        <div
          style={{
            opacity: uiOpacity,
            pointerEvents: uiOpacity > 0.3 ? "auto" : "none",
          }}
        >
          <div style={{ textAlign: "center", padding: "1.5rem 0 1rem" }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--muted)",
                letterSpacing: "0.1em",
                marginBottom: 6,
              }}
            >
              connect with your coffee roots
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 500,
                fontFamily: "var(--font-serif)",
              }}
            >
              What are you in the mood for?
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              margin: "0 auto 1rem",
              maxWidth: 560,
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCoffees()}
              placeholder="e.g. fruity and bright for iced pour over..."
              style={{ flex: 1 }}
            />
            <button
              onClick={searchCoffees}
              disabled={loading || !query.trim()}
              style={{ padding: "0 20px", opacity: loading ? 0.5 : 1 }}
            >
              {loading ? "..." : "Explore"}
            </button>
          </div>

          {!results && !loading && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              {[
                "bold and chocolatey for espresso",
                "light and floral, no bitterness",
                "smooth cold brew for summer",
                "something wild I've never tried",
                "cozy and rich for a rainy day",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  style={{
                    fontSize: 11,
                    padding: "4px 10px",
                    color: "var(--muted)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                color: "var(--danger)",
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Globe */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            position: "relative",
            margin: "0 auto",
            opacity: canvasOpacity,
            transform: `scale(${canvasScale})`,
            transformOrigin: "center center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: GW + 30,
              height: GW + 30,
              borderRadius: "50%",
              top: -15,
              left: "50%",
              transform: "translateX(-50%)",
              background: dk
                ? "radial-gradient(circle, rgba(30,70,150,0.2) 0%, transparent 65%)"
                : "radial-gradient(circle, rgba(50,130,255,0.12) 0%, transparent 65%)",
              pointerEvents: "none",
              opacity: 1 - zoom,
            }}
          />
          <canvas ref={cvRef} style={{ borderRadius: "50%" }} />
        </div>

        {/* Results list */}
        {results && uiOpacity > 0.1 && (
          <div
            style={{
              padding: "1rem 0",
              opacity: uiOpacity,
              pointerEvents: uiOpacity > 0.3 ? "auto" : "none",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: "var(--muted)",
                marginBottom: 10,
              }}
            >
              Top {results.length} matches — tap to explore
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {results.map((c, i) => (
                <div
                  key={c.id}
                  onClick={() => zoomIn(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "var(--surface2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 500,
                      color: "var(--muted)",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: 15 }}>
                        {c.name}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--font-mono)",
                          color: "var(--success)",
                        }}
                      >
                        {c.rating}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginTop: 2,
                      }}
                    >
                      {c.origin} · {c.roast} ·{" "}
                      {c.flavor.slice(0, 3).join(", ")}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--muted)",
                        marginTop: 3,
                        fontStyle: "italic",
                      }}
                    >
                      {c.reason}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--muted)",
                      flexShrink: 0,
                    }}
                  >
                    →
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Origin profile */}
        {showProfile && sel && (
          <div
            style={{
              position: "relative",
              zIndex: 2,
              padding: "1.25rem 1.75rem",
              maxWidth: 560,
              margin: "0 auto",
              opacity: profileOpacity,
            }}
          >
            <button
              onClick={zoomOut}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "#fff",
                padding: "6px 14px",
                fontSize: 13,
                marginBottom: "2rem",
              }}
            >
              ← Zoom out
            </button>

            {/* Header */}
            <div style={{ color: "#fff", marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  opacity: 0.55,
                  letterSpacing: "0.12em",
                  marginBottom: 6,
                }}
              >
                {sel.origin.toUpperCase()} · {sel.region.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 500,
                  fontFamily: "var(--font-serif)",
                  lineHeight: 1.15,
                  marginBottom: 10,
                }}
              >
                {sel.name}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.12)",
                    fontSize: 14,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 500,
                  }}
                >
                  {sel.rating}/10
                </span>
                <span style={{ fontSize: 14, opacity: 0.65 }}>
                  {sel.roast} roast · {sel.process}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                gap: 8,
                marginBottom: "2rem",
              }}
            >
              {[
                { l: "Altitude", v: sel.altitude },
                { l: "Variety", v: sel.variety },
                { l: "Harvest", v: sel.harvest },
                { l: "Process", v: sel.process },
              ].map((d) => (
                <div
                  key={d.l}
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    padding: "10px 12px",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "rgba(255,255,255,0.45)",
                      fontFamily: "var(--font-mono)",
                      marginBottom: 3,
                    }}
                  >
                    {d.l}
                  </div>
                  <div
                    style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}
                  >
                    {d.v}
                  </div>
                </div>
              ))}
            </div>

            {/* Tasting notes */}
            <div style={{ marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "var(--font-mono)",
                  marginBottom: 10,
                }}
              >
                Tasting notes
              </div>
              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
              >
                {sel.flavor.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: 14,
                      padding: "5px 14px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontStyle: "italic",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Cup profile */}
            <div style={{ marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "var(--font-mono)",
                  marginBottom: 10,
                }}
              >
                Cup profile
              </div>
              {[
                { l: "Body", v: sel.body },
                { l: "Acidity", v: sel.acidity },
                { l: "Sweetness", v: sel.sweetness },
              ].map((b) => (
                <div
                  key={b.l}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.55)",
                      width: 72,
                      flexShrink: 0,
                    }}
                  >
                    {b.l}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${b.v * 10}%`,
                        height: "100%",
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.45)",
                        transition: "width 0.6s ease",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                      color: "rgba(255,255,255,0.55)",
                      minWidth: 20,
                      textAlign: "right",
                    }}
                  >
                    {b.v}
                  </span>
                </div>
              ))}
            </div>

            {/* Best brew methods */}
            <div style={{ marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "var(--font-mono)",
                  marginBottom: 8,
                }}
              >
                Best brewed as
              </div>
              <div
                style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
              >
                {sel.bestBrew.map((b) => (
                  <span
                    key={b}
                    style={{
                      fontSize: 13,
                      padding: "4px 12px",
                      borderRadius: 8,
                      background: "rgba(100,180,255,0.12)",
                      color: "rgba(150,210,255,0.85)",
                      border: "1px solid rgba(100,180,255,0.12)",
                    }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Terroir */}
            <div style={{ marginBottom: "2rem" }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  fontFamily: "var(--font-serif)",
                  color: "#fff",
                  marginBottom: 8,
                }}
              >
                Terroir
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.72)",
                  lineHeight: 1.75,
                }}
              >
                {sel.terroir}
              </div>
            </div>

            {/* Unique factor */}
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: 8,
                padding: "16px 18px",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: "2rem",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "var(--font-mono)",
                  marginBottom: 6,
                }}
              >
                What makes it unique
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.75,
                }}
              >
                {sel.uniqueFactor}
              </div>
            </div>

            {/* Find near me */}
            {!nearbyPlaces && (
              <button
                onClick={() => findNearMe(sel)}
                disabled={placesLoading}
                style={{
                  width: "100%",
                  padding: "16px",
                  fontSize: 15,
                  fontWeight: 500,
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#fff",
                  borderRadius: 8,
                }}
              >
                {placesLoading
                  ? "Searching nearby..."
                  : "Find near me"}
              </button>
            )}

            {/* Nearby results */}
            {nearbyPlaces && nearbyPlaces.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 10,
                  }}
                >
                  Specialty coffee shops nearby
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {nearbyPlaces.map((p, i) => (
                    <div
                      key={p.placeId || i}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 8,
                        padding: "12px 14px",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                        }}
                      >
                        <span
                          style={{
                            color: "#fff",
                            fontWeight: 500,
                            fontSize: 14,
                          }}
                        >
                          {p.name}
                        </span>
                        {p.rating && (
                          <span
                            style={{
                              fontSize: 13,
                              fontFamily: "var(--font-mono)",
                              color: "rgba(255,255,255,0.7)",
                            }}
                          >
                            {p.rating} ({p.totalRatings})
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                          marginTop: 4,
                        }}
                      >
                        {p.address}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          marginTop: 6,
                          fontSize: 11,
                        }}
                      >
                        {p.open !== null && (
                          <span
                            style={{
                              color: p.open
                                ? "rgba(100,255,150,0.8)"
                                : "rgba(255,150,100,0.8)",
                            }}
                          >
                            {p.open ? "Open now" : "Closed"}
                          </span>
                        )}
                        {p.priceLevel !== null && (
                          <span
                            style={{
                              color: "rgba(255,255,255,0.4)",
                            }}
                          >
                            {"$".repeat(p.priceLevel || 1)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nearbyPlaces && nearbyPlaces.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                No specialty shops found nearby. Try searching for
                &quot;{sel.origin} coffee&quot; at your favorite local
                roaster.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
