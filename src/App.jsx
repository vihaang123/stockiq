import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

/* ════════════════════════════════════════════════════════════════
   STOCKIQ — Smart Investment & Portfolio Intelligence System
   Complete Edition with Database Management
   ════════════════════════════════════════════════════════════════ */

// ─── Constants & helpers ──────────────────────────────────────────────────────
const APP = "stockiq_v2";
const fmt  = (n, d=2) => Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmtC = (n)      => `₹${fmt(n)}`;
const fmtP = (n)      => `${n>=0?"+":""}${fmt(n)}%`;
const uid  = ()       => Math.random().toString(36).slice(2,10);
const nowS = ()       => new Date().toISOString();
const todayS=()       => new Date().toISOString().split("T")[0];
const clamp=(v,a,b)   => Math.min(b,Math.max(a,v));
const RC   = (level)  => ({High:"#ef4444",Medium:"#f59e0b",Low:"#22c55e","No Holdings":"#6366f1"})[level]||"#6366f1";

// ─── Stock master data — 60 NSE stocks with full fundamentals ────────────────
// Fields: name, sector, base price, mktCap, pe, eps, roe, debtEquity,
//         divYield, revenueGrowth, w52h (52-week high), w52l (52-week low),
//         volatility (annualised %), rating ("Strong Buy"|"Buy"|"Hold"|"Sell")
const STOCKS = {
  // ── Large Cap IT ──────────────────────────────────────────────────────────
  "TCS.NS"      :{name:"Tata Consultancy Svcs",    sector:"IT",            base:3921.0, mktCap:"₹14.2L Cr", pe:32.1, eps:123.4, roe:47.2, debtEquity:0.0,  divYield:1.4, revenueGrowth:8.2,  w52h:4592, w52l:3311, volatility:18, rating:"Strong Buy"},
  "INFY.NS"     :{name:"Infosys",                  sector:"IT",            base:1432.8, mktCap:"₹6.0L Cr",  pe:26.8, eps:53.4,  roe:32.8, debtEquity:0.0,  divYield:2.1, revenueGrowth:6.4,  w52h:1903, w52l:1308, volatility:22, rating:"Buy"},
  "HCLTECH.NS"  :{name:"HCL Technologies",         sector:"IT",            base:1623.4, mktCap:"₹4.4L Cr",  pe:24.6, eps:66.0,  roe:24.1, debtEquity:0.0,  divYield:3.2, revenueGrowth:9.8,  w52h:1960, w52l:1235, volatility:20, rating:"Strong Buy"},
  "WIPRO.NS"    :{name:"Wipro",                    sector:"IT",            base:456.9,  mktCap:"₹2.4L Cr",  pe:21.4, eps:21.3,  roe:14.8, debtEquity:0.0,  divYield:1.8, revenueGrowth:3.2,  w52h:617,  w52l:396,  volatility:24, rating:"Hold"},
  "TECHM.NS"    :{name:"Tech Mahindra",            sector:"IT",            base:1532.4, mktCap:"₹1.5L Cr",  pe:42.3, eps:36.2,  roe:10.4, debtEquity:0.1,  divYield:1.2, revenueGrowth:2.1,  w52h:1807, w52l:1068, volatility:28, rating:"Hold"},
  "MPHASIS.NS"  :{name:"Mphasis",                  sector:"IT",            base:2312.0, mktCap:"₹0.4L Cr",  pe:28.6, eps:80.8,  roe:21.4, debtEquity:0.0,  divYield:1.6, revenueGrowth:5.4,  w52h:2790, w52l:1936, volatility:30, rating:"Buy"},
  "LTTS.NS"     :{name:"L&T Technology Services",  sector:"IT",            base:4890.0, mktCap:"₹0.5L Cr",  pe:38.2, eps:128.0, roe:29.6, debtEquity:0.0,  divYield:1.0, revenueGrowth:12.4, w52h:6006, w52l:3965, volatility:26, rating:"Buy"},
  // ── Banking & Finance ─────────────────────────────────────────────────────
  "HDFCBANK.NS" :{name:"HDFC Bank",                sector:"Banking",       base:1654.3, mktCap:"₹12.6L Cr", pe:20.3, eps:81.5,  roe:16.8, debtEquity:6.8,  divYield:1.2, revenueGrowth:18.2, w52h:1880, w52l:1363, volatility:19, rating:"Strong Buy"},
  "ICICIBANK.NS":{name:"ICICI Bank",               sector:"Banking",       base:1089.6, mktCap:"₹7.7L Cr",  pe:18.4, eps:59.2,  roe:17.2, debtEquity:5.4,  divYield:0.8, revenueGrowth:21.3, w52h:1361, w52l:898,  volatility:21, rating:"Strong Buy"},
  "SBIN.NS"     :{name:"State Bank of India",      sector:"Banking",       base:812.4,  mktCap:"₹7.3L Cr",  pe:10.2, eps:79.7,  roe:18.1, debtEquity:11.2, divYield:1.8, revenueGrowth:24.6, w52h:912,  w52l:543,  volatility:26, rating:"Buy"},
  "AXISBANK.NS" :{name:"Axis Bank",                sector:"Banking",       base:1134.2, mktCap:"₹3.5L Cr",  pe:15.8, eps:71.8,  roe:16.4, debtEquity:6.2,  divYield:0.1, revenueGrowth:19.8, w52h:1339, w52l:896,  volatility:23, rating:"Buy"},
  "KOTAK.NS"    :{name:"Kotak Mahindra Bank",      sector:"Banking",       base:1876.5, mktCap:"₹3.7L Cr",  pe:22.1, eps:84.9,  roe:13.9, debtEquity:4.8,  divYield:0.1, revenueGrowth:16.4, w52h:2063, w52l:1544, volatility:20, rating:"Buy"},
  "INDUSINDBK.NS":{name:"IndusInd Bank",           sector:"Banking",       base:1045.6, mktCap:"₹0.8L Cr",  pe:11.4, eps:91.7,  roe:14.2, debtEquity:5.9,  divYield:1.2, revenueGrowth:14.8, w52h:1694, w52l:926,  volatility:38, rating:"Hold"},
  "BAJFINANCE.NS":{name:"Bajaj Finance",           sector:"NBFC",          base:6847.2, mktCap:"₹4.2L Cr",  pe:34.2, eps:200.2, roe:22.4, debtEquity:3.9,  divYield:0.4, revenueGrowth:28.4, w52h:8192, w52l:6187, volatility:29, rating:"Buy"},
  "BAJAJFINSV.NS":{name:"Bajaj Finserv",           sector:"NBFC",          base:1621.0, mktCap:"₹2.6L Cr",  pe:24.8, eps:65.4,  roe:12.8, debtEquity:2.4,  divYield:0.1, revenueGrowth:22.1, w52h:2029, w52l:1419, volatility:27, rating:"Buy"},
  "CHOLAFIN.NS" :{name:"Cholamandalam Investment",  sector:"NBFC",          base:1234.0, mktCap:"₹1.0L Cr",  pe:28.4, eps:43.4,  roe:18.6, debtEquity:4.2,  divYield:0.2, revenueGrowth:32.4, w52h:1652, w52l:988,  volatility:32, rating:"Buy"},
  // ── Energy ────────────────────────────────────────────────────────────────
  "RELIANCE.NS" :{name:"Reliance Industries",      sector:"Energy",        base:2847.5, mktCap:"₹19.2L Cr", pe:28.4, eps:100.2, roe:9.8,  debtEquity:0.4,  divYield:0.4, revenueGrowth:6.4,  w52h:3218, w52l:2221, volatility:20, rating:"Buy"},
  "ONGC.NS"     :{name:"Oil & Natural Gas Corp",   sector:"Energy",        base:278.3,  mktCap:"₹3.5L Cr",  pe:8.4,  eps:33.1,  roe:14.8, debtEquity:0.2,  divYield:4.8, revenueGrowth:4.2,  w52h:345,  w52l:193,  volatility:30, rating:"Buy"},
  "IOC.NS"      :{name:"Indian Oil Corporation",   sector:"Energy",        base:168.2,  mktCap:"₹2.4L Cr",  pe:7.4,  eps:22.7,  roe:12.4, debtEquity:0.8,  divYield:5.6, revenueGrowth:3.8,  w52h:196,  w52l:108,  volatility:34, rating:"Hold"},
  "BPCL.NS"     :{name:"Bharat Petroleum Corp",   sector:"Energy",        base:312.8,  mktCap:"₹1.4L Cr",  pe:9.2,  eps:34.0,  roe:19.8, debtEquity:1.0,  divYield:4.2, revenueGrowth:5.1,  w52h:376,  w52l:228,  volatility:36, rating:"Hold"},
  // ── FMCG ──────────────────────────────────────────────────────────────────
  "HINDUNILVR.NS":{name:"Hindustan Unilever",      sector:"FMCG",          base:2634.1, mktCap:"₹6.2L Cr",  pe:55.6, eps:47.4,  roe:19.8, debtEquity:0.0,  divYield:1.8, revenueGrowth:4.2,  w52h:2778, w52l:2148, volatility:14, rating:"Hold"},
  "NESTLEIND.NS":{name:"Nestle India",             sector:"FMCG",          base:2341.6, mktCap:"₹2.3L Cr",  pe:72.4, eps:32.3,  roe:122.4,debtEquity:0.0,  divYield:1.4, revenueGrowth:8.4,  w52h:2778, w52l:2204, volatility:15, rating:"Hold"},
  "DABUR.NS"    :{name:"Dabur India",              sector:"FMCG",          base:524.8,  mktCap:"₹0.9L Cr",  pe:48.2, eps:10.9,  roe:20.4, debtEquity:0.0,  divYield:1.2, revenueGrowth:6.8,  w52h:672,  w52l:476,  volatility:18, rating:"Hold"},
  "MARICO.NS"   :{name:"Marico",                   sector:"FMCG",          base:612.4,  mktCap:"₹0.8L Cr",  pe:46.8, eps:13.1,  roe:38.4, debtEquity:0.0,  divYield:1.8, revenueGrowth:5.2,  w52h:723,  w52l:504,  volatility:16, rating:"Hold"},
  "BRITANNIA.NS":{name:"Britannia Industries",     sector:"FMCG",          base:5124.0, mktCap:"₹1.2L Cr",  pe:52.4, eps:97.8,  roe:58.2, debtEquity:0.3,  divYield:1.4, revenueGrowth:7.4,  w52h:6144, w52l:4638, volatility:17, rating:"Hold"},
  // ── Pharma ────────────────────────────────────────────────────────────────
  "SUNPHARMA.NS":{name:"Sun Pharmaceutical",       sector:"Pharma",        base:1678.4, mktCap:"₹4.0L Cr",  pe:38.6, eps:43.5,  roe:14.8, debtEquity:0.1,  divYield:0.8, revenueGrowth:12.4, w52h:1960, w52l:1141, volatility:22, rating:"Strong Buy"},
  "DRREDDYS.NS" :{name:"Dr. Reddy's Laboratories", sector:"Pharma",        base:5892.0, mktCap:"₹1.0L Cr",  pe:22.1, eps:266.6, roe:16.8, debtEquity:0.1,  divYield:0.4, revenueGrowth:14.8, w52h:7220, w52l:5184, volatility:24, rating:"Strong Buy"},
  "CIPLA.NS"    :{name:"Cipla",                    sector:"Pharma",        base:1512.6, mktCap:"₹1.2L Cr",  pe:26.8, eps:56.4,  roe:16.4, debtEquity:0.1,  divYield:0.4, revenueGrowth:10.2, w52h:1702, w52l:1145, volatility:20, rating:"Buy"},
  "DIVISLAB.NS" :{name:"Divi's Laboratories",      sector:"Pharma",        base:4823.1, mktCap:"₹1.3L Cr",  pe:54.2, eps:89.0,  roe:20.4, debtEquity:0.0,  divYield:0.6, revenueGrowth:4.8,  w52h:5464, w52l:3350, volatility:26, rating:"Buy"},
  "APOLLOHOSP.NS":{name:"Apollo Hospitals",        sector:"Healthcare",    base:6812.0, mktCap:"₹0.9L Cr",  pe:88.4, eps:77.1,  roe:14.8, debtEquity:0.6,  divYield:0.3, revenueGrowth:18.4, w52h:7530, w52l:5182, volatility:28, rating:"Buy"},
  "AUROPHARMA.NS":{name:"Aurobindo Pharma",        sector:"Pharma",        base:1082.0, mktCap:"₹0.6L Cr",  pe:18.4, eps:58.8,  roe:14.2, debtEquity:0.3,  divYield:0.4, revenueGrowth:8.2,  w52h:1380, w52l:896,  volatility:28, rating:"Buy"},
  // ── Auto ──────────────────────────────────────────────────────────────────
  "MARUTI.NS"   :{name:"Maruti Suzuki",            sector:"Auto",          base:11240.0,mktCap:"₹3.6L Cr",  pe:27.3, eps:411.7, roe:16.8, debtEquity:0.0,  divYield:1.2, revenueGrowth:18.4, w52h:13680,w52l:9769, volatility:22, rating:"Buy"},
  "TATAMOTORS.NS":{name:"Tata Motors",             sector:"Auto",          base:934.6,  mktCap:"₹3.5L Cr",  pe:9.2,  eps:101.6, roe:28.4, debtEquity:1.8,  divYield:0.0, revenueGrowth:22.4, w52h:1179, w52l:764,  volatility:32, rating:"Buy"},
  "M&M.NS"      :{name:"Mahindra & Mahindra",      sector:"Auto",          base:2124.0, mktCap:"₹2.6L Cr",  pe:28.4, eps:74.8,  roe:14.8, debtEquity:0.2,  divYield:0.6, revenueGrowth:24.8, w52h:3222, w52l:1699, volatility:30, rating:"Hold"},
  "BAJAJ-AUTO.NS":{name:"Bajaj Auto",              sector:"Auto",          base:8234.0, mktCap:"₹2.3L Cr",  pe:28.8, eps:285.9, roe:24.8, debtEquity:0.0,  divYield:1.4, revenueGrowth:14.2, w52h:12774,w52l:7110, volatility:24, rating:"Buy"},
  "HEROMOTOCO.NS":{name:"Hero MotoCorp",           sector:"Auto",          base:4312.0, mktCap:"₹0.9L Cr",  pe:22.4, eps:192.4, roe:28.4, debtEquity:0.0,  divYield:2.4, revenueGrowth:12.4, w52h:5888, w52l:3786, volatility:22, rating:"Buy"},
  "EICHERMOT.NS":{name:"Eicher Motors",            sector:"Auto",          base:4612.0, mktCap:"₹1.3L Cr",  pe:34.2, eps:134.8, roe:28.2, debtEquity:0.0,  divYield:1.2, revenueGrowth:18.4, w52h:5196, w52l:3447, volatility:26, rating:"Buy"},
  // ── Consumer / Retail ─────────────────────────────────────────────────────
  "TITAN.NS"    :{name:"Titan Company",            sector:"Consumer",      base:3467.8, mktCap:"₹3.1L Cr",  pe:88.4, eps:39.2,  roe:28.4, debtEquity:0.1,  divYield:0.4, revenueGrowth:22.4, w52h:3888, w52l:2626, volatility:24, rating:"Hold"},
  "ASIANPAINT.NS":{name:"Asian Paints",            sector:"Consumer",      base:2891.5, mktCap:"₹2.8L Cr",  pe:54.2, eps:53.3,  roe:31.8, debtEquity:0.1,  divYield:1.2, revenueGrowth:4.2,  w52h:3394, w52l:2175, volatility:22, rating:"Hold"},
  "DMART.NS"    :{name:"Avenue Supermarts (DMart)", sector:"Retail",        base:3812.0, mktCap:"₹2.5L Cr",  pe:88.2, eps:43.2,  roe:14.8, debtEquity:0.0,  divYield:0.0, revenueGrowth:18.2, w52h:5484, w52l:3430, volatility:28, rating:"Hold"},
  "PAGEIND.NS"  :{name:"Page Industries (Jockey)", sector:"Consumer",      base:43280.0,mktCap:"₹0.5L Cr",  pe:62.8, eps:689.0, roe:38.4, debtEquity:0.4,  divYield:0.8, revenueGrowth:12.4, w52h:50990,w52l:37200,volatility:22, rating:"Hold"},
  // ── Infrastructure & Capital Goods ────────────────────────────────────────
  "LT.NS"       :{name:"Larsen & Toubro",          sector:"Infrastructure",base:3512.0, mktCap:"₹5.0L Cr",  pe:35.1, eps:100.1, roe:12.8, debtEquity:1.8,  divYield:0.8, revenueGrowth:18.8, w52h:3990, w52l:2673, volatility:22, rating:"Strong Buy"},
  "ULTRACEMCO.NS":{name:"UltraTech Cement",        sector:"Cement",        base:10234.0,mktCap:"₹2.9L Cr",  pe:32.4, eps:315.9, roe:14.8, debtEquity:0.3,  divYield:0.4, revenueGrowth:14.2, w52h:12440,w52l:8966, volatility:22, rating:"Buy"},
  "SHREECEM.NS" :{name:"Shree Cement",             sector:"Cement",        base:26800.0,mktCap:"₹1.0L Cr",  pe:44.8, eps:598.2, roe:12.4, debtEquity:0.2,  divYield:0.2, revenueGrowth:10.8, w52h:32530,w52l:22680,volatility:20, rating:"Hold"},
  "ABB.NS"      :{name:"ABB India",                sector:"Infrastructure",base:6234.0, mktCap:"₹1.3L Cr",  pe:74.8, eps:83.4,  roe:24.8, debtEquity:0.0,  divYield:0.3, revenueGrowth:22.4, w52h:8956, w52l:5400, volatility:30, rating:"Hold"},
  "SIEMENS.NS"  :{name:"Siemens India",            sector:"Infrastructure",base:7124.0, mktCap:"₹2.5L Cr",  pe:68.4, eps:104.2, roe:18.8, debtEquity:0.0,  divYield:0.4, revenueGrowth:18.2, w52h:8270, w52l:5600, volatility:28, rating:"Hold"},
  // ── Utilities ─────────────────────────────────────────────────────────────
  "POWERGRID.NS":{name:"Power Grid Corporation",   sector:"Utilities",     base:312.4,  mktCap:"₹2.9L Cr",  pe:18.2, eps:17.2,  roe:18.4, debtEquity:1.4,  divYield:4.2, revenueGrowth:6.4,  w52h:366,  w52l:228,  volatility:18, rating:"Buy"},
  "NTPC.NS"     :{name:"NTPC Limited",             sector:"Utilities",     base:378.9,  mktCap:"₹3.7L Cr",  pe:16.8, eps:22.5,  roe:12.4, debtEquity:1.6,  divYield:2.8, revenueGrowth:8.2,  w52h:448,  w52l:278,  volatility:20, rating:"Buy"},
  "TATAPOWER.NS":{name:"Tata Power Company",       sector:"Utilities",     base:384.0,  mktCap:"₹1.2L Cr",  pe:28.4, eps:13.5,  roe:9.8,  debtEquity:1.8,  divYield:0.6, revenueGrowth:12.8, w52h:494,  w52l:321,  volatility:30, rating:"Hold"},
  "ADANIGREEN.NS":{name:"Adani Green Energy",      sector:"Utilities",     base:1724.0, mktCap:"₹2.7L Cr",  pe:188.4,eps:9.1,   roe:8.4,  debtEquity:8.4,  divYield:0.0, revenueGrowth:28.4, w52h:2174, w52l:942,  volatility:48, rating:"Hold"},
  // ── Metals & Mining ───────────────────────────────────────────────────────
  "JSWSTEEL.NS" :{name:"JSW Steel",                sector:"Metals",        base:912.3,  mktCap:"₹2.2L Cr",  pe:18.6, eps:49.0,  roe:14.2, debtEquity:1.0,  divYield:1.2, revenueGrowth:8.4,  w52h:1063, w52l:743,  volatility:28, rating:"Hold"},
  "TATASTEEL.NS":{name:"Tata Steel",               sector:"Metals",        base:168.4,  mktCap:"₹2.1L Cr",  pe:22.4, eps:7.5,   roe:8.8,  debtEquity:1.8,  divYield:1.8, revenueGrowth:4.2,  w52h:184,  w52l:120,  volatility:32, rating:"Hold"},
  "HINDALCO.NS" :{name:"Hindalco Industries",      sector:"Metals",        base:634.8,  mktCap:"₹1.4L Cr",  pe:14.8, eps:42.9,  roe:12.4, debtEquity:0.8,  divYield:0.8, revenueGrowth:6.4,  w52h:772,  w52l:514,  volatility:26, rating:"Buy"},
  "COALINDIA.NS":{name:"Coal India",               sector:"Metals",        base:462.4,  mktCap:"₹2.9L Cr",  pe:8.4,  eps:55.0,  roe:58.4, debtEquity:0.0,  divYield:5.8, revenueGrowth:4.2,  w52h:544,  w52l:356,  volatility:22, rating:"Buy"},
  // ── Conglomerate / Others ─────────────────────────────────────────────────
  "ADANIENT.NS" :{name:"Adani Enterprises",        sector:"Conglomerate",  base:2456.8, mktCap:"₹2.8L Cr",  pe:98.4, eps:24.9,  roe:8.8,  debtEquity:2.4,  divYield:0.0, revenueGrowth:34.2, w52h:3244, w52l:2037, volatility:44, rating:"Hold"},
  "ITC.NS"      :{name:"ITC Limited",              sector:"FMCG",          base:468.2,  mktCap:"₹5.8L Cr",  pe:28.4, eps:16.5,  roe:28.4, debtEquity:0.0,  divYield:3.4, revenueGrowth:8.4,  w52h:528,  w52l:401,  volatility:16, rating:"Strong Buy"},
  "TATACONSUM.NS":{name:"Tata Consumer Products",  sector:"FMCG",          base:1082.0, mktCap:"₹1.0L Cr",  pe:64.2, eps:16.9,  roe:9.8,  debtEquity:0.1,  divYield:0.8, revenueGrowth:12.4, w52h:1264, w52l:878,  volatility:22, rating:"Hold"},
  "GODREJCP.NS" :{name:"Godrej Consumer Products", sector:"FMCG",          base:1234.0, mktCap:"₹1.3L Cr",  pe:44.8, eps:27.5,  roe:18.4, debtEquity:0.2,  divYield:0.8, revenueGrowth:10.2, w52h:1558, w52l:994,  volatility:20, rating:"Hold"},
  "PIDILITIND.NS":{name:"Pidilite Industries",     sector:"Consumer",      base:2876.0, mktCap:"₹1.5L Cr",  pe:74.8, eps:38.4,  roe:26.4, debtEquity:0.0,  divYield:0.6, revenueGrowth:8.4,  w52h:3334, w52l:2364, volatility:20, rating:"Hold"},
  "HAVELLS.NS"  :{name:"Havells India",            sector:"Consumer",      base:1628.0, mktCap:"₹1.0L Cr",  pe:58.4, eps:27.9,  roe:18.8, debtEquity:0.0,  divYield:0.6, revenueGrowth:14.2, w52h:2040, w52l:1322, volatility:22, rating:"Hold"},
  "^NSEI"       :{name:"NIFTY 50 Index",           sector:"Index",         base:22847.0,mktCap:"—",         pe:22.4, eps:0, roe:0, debtEquity:0, divYield:0, revenueGrowth:0, w52h:26277, w52l:18837, volatility:15, rating:"—"},
};

// ── Technical & Fundamental Signal Engine ────────────────────────────────────
// Generates price history, computes SMA, RSI, volatility alerts, buy signals
function genPriceHistory(sym, days=90) {
  const s = STOCKS[sym]; if(!s) return [];
  const seed = sym.split('').reduce((a,c)=>a+c.charCodeAt(0),0);
  let price = s.base * (0.92 + (seed%17)/100);
  const hist = [];
  for(let i=days;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const vol = s.volatility/100/Math.sqrt(252);
    price = price * (1 + (Math.random()-0.497)*vol*2.2);
    price = Math.max(price, s.base*0.5);
    hist.push({ date:d.toISOString().split('T')[0], close:+price.toFixed(2),
      volume: Math.floor(1e6*(0.5+Math.random())) });
  }
  return hist;
}
function calcSMA(prices, period) {
  return prices.map((_,i)=>
    i<period-1?null: +(prices.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period).toFixed(2)
  );
}
function calcRSI(prices, period=14) {
  const rsi=[]; let gains=0,losses=0;
  for(let i=1;i<prices.length;i++){
    const d=prices[i]-prices[i-1];
    if(i<=period){gains+=d>0?d:0;losses+=d<0?-d:0;}
    if(i===period){rsi.push(null);continue;}
    if(i>period){
      const ag=gains/period, al=losses/period;
      rsi.push(al===0?100:+(100-100/(1+ag/al)).toFixed(1));
      gains=d>0?d:0;losses=d<0?-d:0;
    } else rsi.push(null);
  }
  return [null,...rsi];
}
function getSignal(sym) {
  const s = STOCKS[sym]; if(!s||sym==="^NSEI") return null;
  const hist = genPriceHistory(sym, 60);
  const closes = hist.map(h=>h.close);
  const sma20 = calcSMA(closes,20); const sma50 = calcSMA(closes,50);
  const rsi = calcRSI(closes);
  const cur = closes[closes.length-1];
  const last20 = sma20[sma20.length-1]; const last50 = sma50[sma50.length-1];
  const lastRsi = rsi[rsi.length-1]||50;
  const fromW52L = ((cur-s.w52l)/s.w52l)*100;
  const fromW52H = ((s.w52h-cur)/s.w52h)*100;
  const alerts = [];
  if(s.volatility>=40) alerts.push({type:"danger",msg:`⚠ Very High Volatility (${s.volatility}% ann.) — High Risk`});
  else if(s.volatility>=28) alerts.push({type:"warn",msg:`⚡ Elevated Volatility (${s.volatility}% ann.) — Moderate Risk`});
  if(lastRsi>70) alerts.push({type:"warn",msg:`RSI ${lastRsi} — Overbought, potential pullback`});
  if(lastRsi<30) alerts.push({type:"info",msg:`RSI ${lastRsi} — Oversold, potential bounce`});
  if(last20&&last50&&last20>last50) alerts.push({type:"success",msg:"Golden Cross: SMA20 > SMA50 — Bullish trend"});
  if(last20&&last50&&last20<last50) alerts.push({type:"warn",msg:"Death Cross: SMA20 < SMA50 — Bearish signal"});
  if(fromW52L<15) alerts.push({type:"info",msg:`Near 52-week low (${fromW52L.toFixed(1)}% above) — Possible value entry`});
  if(fromW52H<10) alerts.push({type:"warn",msg:`Near 52-week high (${fromW52H.toFixed(1)}% below) — Resistance ahead`});
  const fundamentalScore = (
    (s.roe>20?3:s.roe>15?2:s.roe>10?1:0)+
    (s.pe<20?3:s.pe<35?2:s.pe<55?1:0)+
    (s.debtEquity<0.5?3:s.debtEquity<1?2:s.debtEquity<2?1:0)+
    (s.revenueGrowth>15?3:s.revenueGrowth>8?2:s.revenueGrowth>3?1:0)+
    (s.divYield>3?2:s.divYield>1?1:0)
  );
  let buySignal="Hold";
  if(fundamentalScore>=11&&lastRsi<65&&last20&&last50&&last20>last50) buySignal="Strong Buy";
  else if(fundamentalScore>=8&&lastRsi<72) buySignal="Buy";
  else if(fundamentalScore<=4||lastRsi>75) buySignal="Sell";
  return {alerts,fundamentalScore,rsi:lastRsi,sma20:last20,sma50:last50,cur,buySignal,hist};
}

const SECTOR_COLORS = {
  "Energy":"#f59e0b","IT":"#6366f1","Banking":"#3b82f6","FMCG":"#10b981",
  "NBFC":"#8b5cf6","Auto":"#f97316","Infrastructure":"#64748b","Consumer":"#ec4899",
  "Pharma":"#06b6d4","Utilities":"#84cc16","Conglomerate":"#ef4444",
  "Cement":"#a78bfa","Metals":"#94a3b8","Index":"#475569","Healthcare":"#0ea5e9",
  "Retail":"#f43f5e","Other":"#64748b",
};

// Simulated live price (small variance each call)
const priceSeeds = {};
function livePrice(sym) {
  const s = STOCKS[sym]; if(!s) return null;
  if(!priceSeeds[sym]) priceSeeds[sym] = s.base*(0.96 + Math.random()*0.08);
  priceSeeds[sym] = priceSeeds[sym]*(1 + (Math.random()-0.495)*0.004);
  return +priceSeeds[sym].toFixed(2);
}
function liveChange(sym) {
  const s = STOCKS[sym]; if(!s) return 0;
  const cur = priceSeeds[sym]||s.base;
  return +((cur-s.base)/s.base*100).toFixed(2);
}
function searchStocks(q) {
  if(!q||q.length<2) return [];
  const u = q.toUpperCase();
  return Object.entries(STOCKS)
    .filter(([k,v])=>k.includes(u)||v.name.toUpperCase().includes(u))
    .filter(([k])=>k!=="^NSEI")
    .slice(0,8)
    .map(([symbol,info])=>({symbol,...info,price:livePrice(symbol),change:liveChange(symbol)}));
}

/* ════════════════════════════════════════════════════════════════
   API / STORAGE LAYER
   ─ When FastAPI backend is running at localhost:8000: uses API
   ─ When running as Claude artifact (no backend): uses localStorage
   ════════════════════════════════════════════════════════════════ */
const API_BASE = "https://stockiq-3f7q.onrender.com";

// Token persisted in localStorage — survives page refresh
const TOKEN_KEY = "stockiq_jwt";
function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(t){ if(t) localStorage.setItem(TOKEN_KEY,t); else localStorage.removeItem(TOKEN_KEY); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

// ── apiFetch: reads token from localStorage on every call ────────────────────
async function apiFetch(path, opts={}) {
  const headers = { "Content-Type":"application/json" };
  const tok = getToken();
  if(tok) headers["Authorization"] = "Bearer " + tok;
  const res = await fetch(API_BASE + path, { ...opts, headers:{ ...headers, ...(opts.headers||{}) } });
  if(!res.ok){
    let msg = "Request failed";
    try{
      const e = await res.json();
      msg = e.detail || (typeof e === "string" ? e : JSON.stringify(e));
    }catch{}
    // 401 = token expired / invalid — clear it so auto-login retries
    if(res.status === 401) clearToken();
    throw new Error(msg);
  }
  if(res.status === 204) return null;
  return res.json();
}

async function apiLogin(username, password) {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(API_BASE + "/auth/login", {
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body
  });
  if(!res.ok){
    let msg="Invalid username or password";
    try{ const e=await res.json(); msg=e.detail||msg; }catch{}
    throw new Error(msg);
  }
  return res.json();
}






// ─── Risk Engine ──────────────────────────────────────────────────────────────
function calcRisk(portfolio, priceMap){
  const holdings=Object.entries(portfolio);
  const n=holdings.length;
  if(!n) return {score:0,level:"No Holdings",sectors:{},insights:[],totalVal:0};

  const sectors={};
  let totalVal=0;
  holdings.forEach(([sym,h])=>{
    const p=priceMap[sym]||h.avgPrice;
    const v=h.qty*p; totalVal+=v;
    const sec=STOCKS[sym]?.sector||"Other";
    sectors[sec]=(sectors[sec]||0)+v;
  });

  const sectorPcts={};
  Object.entries(sectors).forEach(([s,v])=>{ sectorPcts[s]=(v/totalVal)*100; });
  const maxSec=Math.max(...Object.values(sectorPcts));
  const secCount=Object.keys(sectorPcts).length;

  let score=50;
  if(n<3) score+=30;
  else if(n<5) score+=15;
  else if(n>=8) score-=10;
  else if(n>=12) score-=20;

  if(maxSec>60) score+=20;
  else if(maxSec>45) score+=10;
  else if(maxSec<25) score-=10;

  if(secCount<2) score+=10;
  else if(secCount>=5) score-=10;

  score=clamp(score,0,100);
  const level=score>=70?"High":score>=40?"Medium":"Low";

  const insights=[];
  Object.entries(sectorPcts).forEach(([s,pct])=>{
    if(pct>55) insights.push({type:"warning",msg:`Overexposed to ${s} sector (${fmt(pct,0)}% of portfolio)`});
  });
  if(n<3)  insights.push({type:"danger", msg:"Very low diversification — fewer than 3 stocks is high risk"});
  if(n>=3&&n<5) insights.push({type:"info",msg:"Consider adding 2–3 more stocks to improve diversification"});
  if(secCount<3&&n>=3) insights.push({type:"warning",msg:"Portfolio spans fewer than 3 sectors — consider diversifying"});
  const hasPharma=holdings.some(([s])=>STOCKS[s]?.sector==="Pharma");
  const hasIT=holdings.some(([s])=>STOCKS[s]?.sector==="IT");
  const hasBanking=holdings.some(([s])=>STOCKS[s]?.sector==="Banking");
  if(!hasPharma) insights.push({type:"info",msg:"Adding Pharma stocks provides defensive exposure to your portfolio"});
  if(!hasIT&&n>=3) insights.push({type:"info",msg:"IT sector offers strong long-term growth potential"});
  if(hasBanking){
    const bankPct=Object.entries(sectorPcts).find(([s])=>s==="Banking")?.[1]||0;
    if(bankPct>40) insights.push({type:"warning",msg:`Banking exposure at ${fmt(bankPct,0)}% — consider balancing with other sectors`});
  }
  if(maxSec<30&&n>=5) insights.push({type:"success",msg:"Excellent diversification! Your portfolio has healthy sector balance."});
  if(score<35) insights.push({type:"success",msg:"Low risk portfolio — well balanced across stocks and sectors"});

  return {score,level,sectors:sectorPcts,insights,totalVal};
}

/* ════════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ════════════════════════════════════════════════════════════════ */
function useToast(){
  const [toasts,set]=useState([]);
  const add=(msg,type="success")=>{
    const id=uid_gen(); set(t=>[...t,{id,msg,type}]);
    setTimeout(()=>set(t=>t.filter(x=>x.id!==id)),3800);
  };
  return {toasts,add,remove:(id)=>set(t=>t.filter(x=>x.id!==id))};
}

function Toast({toasts,remove}){
  const bg={success:"#16a34a",error:"#dc2626",info:"#2563eb",warning:"#d97706"};
  const ic={success:"✓",error:"✕",info:"ℹ",warning:"⚠"};
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
      {toasts.map(t=>(
        <div key={t.id} onClick={()=>remove(t.id)}
          style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderRadius:10,fontSize:13,fontWeight:500,
            cursor:"pointer",minWidth:240,maxWidth:340,pointerEvents:"all",
            background:bg[t.type]||bg.info,color:"#fff",
            boxShadow:"0 4px 24px rgba(0,0,0,0.3)",animation:"slideIn 0.28s ease"}}>
          <span style={{width:18,height:18,borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0}}>{ic[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function Spinner({size=16,color="#fff"}){
  return <div style={{width:size,height:size,border:`2px solid ${color}40`,borderTopColor:color,borderRadius:"50%",animation:"spin 0.65s linear infinite",flexShrink:0}} />;
}

function LiveDot(){
  return <span style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",display:"inline-block",marginRight:5,animation:"pulse 2s ease-in-out infinite"}} />;
}

function Badge({children,color="#6366f1"}){
  return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:`${color}20`,color}}>{children}</span>;
}

function Card({children,style={},pad=20}){
  return <div style={{background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:pad,...style}}>{children}</div>;
}

function MetricCard({label,value,sub,color="var(--acc)",icon,delta}){
  return (
    <div style={{background:"var(--card2)",border:"1px solid var(--brd)",borderRadius:12,padding:"16px 18px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <span style={{fontSize:11,color:"var(--t3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</span>
        {icon&&<span style={{fontSize:18,opacity:0.7}}>{icon}</span>}
      </div>
      <div style={{fontSize:22,fontWeight:700,color,lineHeight:1.1}}>{value}</div>
      {sub&&<div style={{fontSize:12,color:"var(--t2)",marginTop:5}}>{sub}</div>}
      {delta!=null&&<div style={{fontSize:12,marginTop:5,color:delta>=0?"#22c55e":"#ef4444",fontWeight:600}}>{delta>=0?"▲":"▼"} {fmt(Math.abs(delta))}%</div>}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   CHARTS
   ════════════════════════════════════════════════════════════════ */
function MiniLineChart({data=[],color="#6366f1",height=80,showDots=false}){
  if(data.length<2) return <div style={{height,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)",fontSize:12}}>No data yet</div>;
  const vals=data.map(d=>typeof d==="number"?d:d.value);
  const min=Math.min(...vals), max=Math.max(...vals), range=max-min||1;
  const W=500,H=height,P=6;
  const pts=vals.map((v,i)=>[P+(i/(vals.length-1))*(W-P*2), P+(1-(v-min)/range)*(H-P*2)]);
  const line=pts.map((p,i)=>`${i?"L":"M"}${p[0]},${p[1]}`).join(" ");
  const fill=line+` L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H}Z`;
  const isUp=(vals[vals.length-1]||0)>=(vals[0]||0);
  const c=isUp?"#22c55e":"#ef4444";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height,display:"block"}} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g_${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={c} stopOpacity="0.01"/>
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#g_${color.replace("#","")})`}/>
      <path d={line} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {showDots&&pts.map((p,i)=>i===pts.length-1&&<circle key={i} cx={p[0]} cy={p[1]} r="4" fill={c}/>)}
    </svg>
  );
}

function DonutChart({sectors,size=160}){
  const entries=Object.entries(sectors||{}).filter(([,v])=>v>0);
  if(!entries.length) return <div style={{width:size,height:size,borderRadius:"50%",background:"var(--brd)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)",fontSize:12}}>No data</div>;
  const R=size/2-8,cx=size/2,cy=size/2;
  let cum=0;
  const slices=entries.map(([name,pct])=>{
    const s=cum/100*2*Math.PI-Math.PI/2;
    cum+=pct;
    const e=cum/100*2*Math.PI-Math.PI/2;
    const x1=cx+R*Math.cos(s),y1=cy+R*Math.sin(s);
    const x2=cx+R*Math.cos(e),y2=cy+R*Math.sin(e);
    return {name,pct,path:`M${cx},${cy} L${x1},${y1} A${R},${R},0,${pct>50?1:0},1,${x2},${y2}Z`,color:SECTOR_COLORS[name]||"#6366f1"};
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{width:size,height:size,flexShrink:0}}>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke="var(--bg)" strokeWidth="2"/>)}
      <circle cx={cx} cy={cy} r={R*0.52} fill="var(--bg)"/>
      <text x={cx} y={cy-4} textAnchor="middle" fontSize="11" fill="var(--t2)">Sectors</text>
      <text x={cx} y={cy+10} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--t1)">{entries.length}</text>
    </svg>
  );
}

function RiskGauge({score,level}){
  const c=RC(level);
  const pct=clamp(score,0,100);
  return (
    <div>
      <div style={{height:10,background:"var(--brd)",borderRadius:10,overflow:"hidden",marginBottom:8}}>
        <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,#22c55e 0%,#f59e0b 50%,#ef4444 100%)`,borderRadius:10,transition:"width 0.8s ease"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t3)"}}>
        <span>Low (0)</span><span>Medium (50)</span><span>High (100)</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
        <span style={{fontSize:28,fontWeight:700,color:c}}>{score}</span>
        <div><div style={{fontSize:14,fontWeight:600,color:c}}>{level} Risk</div><div style={{fontSize:11,color:"var(--t3)"}}>Current score</div></div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STOCK SEARCH COMPONENT
   ════════════════════════════════════════════════════════════════ */
function StockSearch({onSelect,placeholder="Search Indian stocks...",className}){
  const [q,setQ]=useState("");
  const [results,setResults]=useState([]);
  const [open,setOpen]=useState(false);
  const ref=useRef();

  useEffect(()=>{
    const r=searchStocks(q); setResults(r); setOpen(r.length>0);
  },[q]);

  return (
    <div style={{position:"relative"}} ref={ref}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder={placeholder}
        onFocus={()=>results.length&&setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),200)}
        style={{background:"var(--card)",border:"1px solid var(--brd)",color:"var(--t1)",borderRadius:10,padding:"10px 14px",width:"100%",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
      {open&&results.length>0&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"var(--card)",border:"1px solid var(--brd)",borderRadius:12,zIndex:200,overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
          {results.map(r=>(
            <div key={r.symbol} onClick={()=>{onSelect(r);setQ(r.symbol);setOpen(false);}}
              style={{padding:"11px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid var(--brd)",transition:"background 0.12s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.08)"}
              onMouseLeave={e=>e.currentTarget.style.background=""}>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>{r.symbol}</div>
                <div style={{fontSize:11,color:"var(--t3)"}}>{r.name} · {r.sector}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,fontSize:13}}>{fmtC(r.price)}</div>
                <div style={{fontSize:11,color:r.change>=0?"#22c55e":"#ef4444",fontWeight:600}}>{fmtP(r.change)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   AUTH PAGE
   ════════════════════════════════════════════════════════════════ */
function AuthPage({onAuth}){
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({username:"",password:"",email:""});
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const {toasts,add:toast,remove}=useToast();

  const submit=async()=>{
    setErr(""); setLoading(true);
    const {username,password,email}=form;
    if(!username.trim()||!password){setErr("All fields required");setLoading(false);return;}
    if(password.length<4){setErr("Password must be 4+ characters");setLoading(false);return;}

    try{
      if(mode==="register"){
        const regBody = email ? {username,password,email} : {username,password};
        await apiFetch("/auth/register",{method:"POST",body:JSON.stringify(regBody)});
        toast("Account created! Sign in now.","success");
        setMode("login"); setLoading(false); return;
      }
      const data=await apiLogin(username,password);
      setToken(data.access_token);
      toast("Welcome back!","success");
      setTimeout(()=>onAuth({username:data.username}),300);
    }catch(e){
      setErr(e.message||"Something went wrong");
    }
    setLoading(false);
  };

  const demo=async()=>{
    setLoading(true); setErr("");
    try{
      // Register demo user (silent fail if exists)
      try{ await apiFetch("/auth/register",{method:"POST",body:JSON.stringify({username:"demo_user",password:"demo123",email:"demo@stockiq.in"})}); }catch{}
      const data=await apiLogin("demo_user","demo123");
      setToken(data.access_token);
      toast("Welcome, Demo User!","success");
      setTimeout(()=>onAuth({username:data.username}),300);
    }catch(e){ setErr("Demo login failed: "+e.message); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{width:"100%",maxWidth:420,animation:"fadeUp 0.5s ease"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:64,height:64,borderRadius:18,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px"}}>📈</div>
          <h1 style={{fontSize:28,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.5px"}}>StockIQ</h1>
          <p style={{color:"var(--t2)",fontSize:14,marginTop:4}}>Smart Portfolio Intelligence · Indian Markets</p>
        </div>

        <Card pad={28}>
          {/* Tab */}
          <div style={{display:"flex",gap:4,marginBottom:24,background:"var(--bg)",borderRadius:10,padding:4}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>{setMode(m);setErr("");}}
                style={{flex:1,padding:"8px 0",borderRadius:8,border:"none",fontSize:13,fontWeight:700,
                  background:mode===m?"var(--acc)":"transparent",color:mode===m?"#fff":"var(--t2)",
                  cursor:"pointer",transition:"all 0.2s",fontFamily:"inherit"}}>
                {m==="login"?"Sign In":"Sign Up"}
              </button>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:500}}>Username</label>
              <input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="your_username"
                onKeyDown={e=>e.key==="Enter"&&submit()}
                style={{background:"var(--card2)",border:"1px solid var(--brd)",color:"var(--t1)",borderRadius:10,padding:"11px 14px",width:"100%",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
            </div>
            {mode==="register"&&(
              <div>
                <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:500}}>Email (optional)</label>
                <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="you@example.com"
                  style={{background:"var(--card2)",border:"1px solid var(--brd)",color:"var(--t1)",borderRadius:10,padding:"11px 14px",width:"100%",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
              </div>
            )}
            <div>
              <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:500}}>Password</label>
              <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="••••••••"
                onKeyDown={e=>e.key==="Enter"&&submit()}
                style={{background:"var(--card2)",border:"1px solid var(--brd)",color:"var(--t1)",borderRadius:10,padding:"11px 14px",width:"100%",fontSize:14,outline:"none",fontFamily:"inherit"}}/>
            </div>
            {err&&<div style={{padding:"9px 13px",borderRadius:8,background:"#ef444420",border:"1px solid #ef444440",color:"#ef4444",fontSize:13}}>{err}</div>}
            <button onClick={submit} disabled={loading}
              style={{padding:"13px",borderRadius:10,background:"var(--acc)",color:"#fff",border:"none",fontWeight:700,fontSize:15,
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",marginTop:4,fontFamily:"inherit",
                opacity:loading?0.8:1,transition:"opacity 0.2s"}}>
              {loading?<Spinner/>:mode==="login"?"Sign In →":"Create Account"}
            </button>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1,height:1,background:"var(--brd)"}}/>
              <span style={{fontSize:12,color:"var(--t3)"}}>or</span>
              <div style={{flex:1,height:1,background:"var(--brd)"}}/>
            </div>
            <button onClick={demo}
              style={{padding:"11px",borderRadius:10,background:"transparent",color:"var(--t2)",border:"1px solid var(--brd)",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
              🚀 Try with Demo Account
            </button>
          </div>
        </Card>
        <p style={{textAlign:"center",color:"var(--t3)",fontSize:11,marginTop:16}}>Powered by StockIQ API · stockiq-3f7q.onrender.com</p>
      </div>
      <Toast toasts={toasts} remove={remove}/>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN APP SHELL
   ════════════════════════════════════════════════════════════════ */
export default function App(){
  const [user,setUser]=useState(null);
  const [theme,setTheme]=useState("dark");
  const [page,setPage]=useState("dashboard");
  const [portfolio,setPortfolio]=useState({});
  const [prices,setPrices]=useState({});
  const [history,setHistory]=useState([]);
  const [watchlist,setWatchlist]=useState([]);
  const {toasts,add:toast,remove:removeToast}=useToast();

  const refreshPrices=useCallback(()=>{
    const syms=[...Object.keys(portfolio),"^NSEI"];
    if(watchlist.length) syms.push(...watchlist);
    const p={}; syms.forEach(s=>{p[s]=livePrice(s);});
    setPrices(p);
  },[portfolio,watchlist]);

  // ── Auto-login on refresh: restore session from localStorage token ──────────
  useEffect(()=>{
    const tok = getToken();
    if(!tok || user) return;
    apiFetch("/auth/me")
      .then(data=>{ setUser({username:data.username}); })
      .catch(()=>{ clearToken(); });
  },[]);

  // ── Load all data from FastAPI on login ────────────────────────────────────
  const loadAllData = useCallback(async()=>{
    if(!user) return;
    try{
      const [portData,histData,watchData] = await Promise.all([
        apiFetch("/portfolio"),
        apiFetch("/history"),
        apiFetch("/watchlist"),
      ]);
      // Convert portfolio array -> {symbol: {qty, avgPrice}} map
      const portMap={};
      ((portData&&portData.holdings)||[]).forEach(h=>{ portMap[h.symbol]={qty:h.qty,avgPrice:h.avg_price}; });
      setPortfolio(portMap);
      // History: [{date,value}]
      setHistory((histData||[]).map(h=>({date:h.date,value:h.value})));
      // Watchlist: array of symbols
      setWatchlist((watchData||[]).map(w=>w.symbol||w));
    }catch(e){ toast("Failed to load data: "+e.message,"error"); }
  },[user]);

  useEffect(()=>{ loadAllData(); },[loadAllData]);
  useEffect(()=>{ if(user) refreshPrices(); },[refreshPrices,user]);

  useEffect(()=>{
    if(!user) return;
    const iv=setInterval(refreshPrices,7000);
    return ()=>clearInterval(iv);
  },[user,refreshPrices]);

  // Push daily NAV snapshot to backend once per day
  const lastHistPush = useRef("");
  useEffect(()=>{
    if(!user||!Object.keys(portfolio).length) return;
    const today=todayS();
    if(lastHistPush.current===today) return;
    lastHistPush.current=today;
    const total=Object.entries(portfolio).reduce((s,[sym,h])=>s+h.qty*(prices[sym]||h.avgPrice),0);
    apiFetch("/history",{method:"POST",body:JSON.stringify({date:today,value:+total.toFixed(2)})})
      .then(()=>apiFetch("/history").then(d=>setHistory((d||[]).map(h=>({date:h.date,value:h.value})))))
      .catch(()=>{});
  },[prices]);

  const buyStock=async(symbol,qty,price)=>{
    try{
      const result=await apiFetch("/portfolio/buy",{method:"POST",body:JSON.stringify({symbol,qty,price})});
      // Reload full portfolio from backend to stay in sync
      const portData=await apiFetch("/portfolio");
      const portMap={};
      (portData?.holdings||[]).forEach(h=>{ portMap[h.symbol]={qty:h.qty,avgPrice:h.avg_price}; });
      setPortfolio(portMap);
      toast(`Bought ${qty} × ${symbol} @ ${fmtC(price)}`,"success");
    }catch(e){ toast("Buy failed: "+e.message,"error"); }
  };

  const sellStock=async(symbol,qty,price)=>{
    try{
      await apiFetch("/portfolio/sell",{method:"POST",body:JSON.stringify({symbol,qty,price})});
      const portData=await apiFetch("/portfolio");
      const portMap={};
      (portData?.holdings||[]).forEach(h=>{ portMap[h.symbol]={qty:h.qty,avgPrice:h.avg_price}; });
      setPortfolio(portMap);
      toast(`Sold ${qty} × ${symbol} @ ${fmtC(price)}`,"success");
    }catch(e){ toast("Sell failed: "+e.message,"error"); }
  };

  const toggleWatch=async(sym)=>{
    try{
      if(watchlist.includes(sym)){
        await apiFetch("/watchlist/"+encodeURIComponent(sym),{method:"DELETE"});
        setWatchlist(w=>w.filter(s=>s!==sym));
        toast(`Removed ${sym} from watchlist`,"info");
      }else{
        await apiFetch("/watchlist",{method:"POST",body:JSON.stringify({symbol:sym})});
        setWatchlist(w=>[...w,sym]);
        toast(`Added ${sym} to watchlist`,"success");
      }
    }catch(e){ toast("Watchlist error: "+e.message,"error"); }
  };

  if(!user) return (
    <div data-theme={theme} style={{background:theme==="dark"?"#0d1117":"#f0f4f8",minHeight:"100vh"}}>
      <GlobalStyles theme={theme}/>
      <AuthPage onAuth={setUser}/>
    </div>
  );

  const safePortfolio = portfolio||{};
  const risk=calcRisk(safePortfolio,prices);
  const totalVal=Object.entries(safePortfolio).reduce((s,[sym,h])=>s+(h&&h.qty?h.qty*(prices[sym]||h.avgPrice):0),0);
  const totalCost=Object.entries(safePortfolio).reduce((s,[,h])=>s+(h&&h.qty?h.qty*h.avgPrice:0),0);
  const totalPnL=totalVal-totalCost;
  const totalPnLPct=totalCost?(totalPnL/totalCost)*100:0;

  const NAV=[
    {id:"dashboard",   label:"Dashboard",    icon:"⊞"},
    {id:"markets",     label:"Markets",      icon:"📊"},
    {id:"portfolio",   label:"Portfolio",    icon:"◎"},
    {id:"trade",       label:"Trade",        icon:"⇄"},
    {id:"risk",        label:"Risk Analysis",icon:"🛡"},
    {id:"simulate",    label:"Simulate",     icon:"◈"},
    {id:"transactions",label:"Transactions", icon:"📋"},
    {id:"watchlist",   label:"Watchlist",    icon:"⭐"},
    {id:"database",    label:"Database",     icon:"🗄"},
    {id:"settings",    label:"Settings",     icon:"⚙"},
  ];

  const PAGES={
    dashboard:<DashboardPage portfolio={safePortfolio} prices={prices} risk={risk} totalVal={totalVal} totalPnL={totalPnL} totalPnLPct={totalPnLPct} history={history||[]} user={user}/>,
    markets:<MarketsPage portfolio={portfolio} prices={prices} watchlist={watchlist} onWatch={toggleWatch} onTrade={(sym)=>{setPage("trade");}}/>,
    portfolio:<PortfolioPage portfolio={safePortfolio} prices={prices} toast={toast} onWatch={toggleWatch} watchlist={watchlist||[]}/>,
    trade:<TradePage portfolio={safePortfolio} prices={prices} onBuy={buyStock} onSell={sellStock} watchlist={watchlist||[]} onWatch={toggleWatch}/>,
    risk:<RiskAnalysisPage portfolio={safePortfolio} prices={prices} risk={risk} user={user} totalVal={totalVal} history={history||[]}/>,
    simulate:<SimulatePage portfolio={safePortfolio} prices={prices} risk={risk} toast={toast} user={user}/>,
    transactions:<TransactionsPage user={user} portfolio={portfolio} prices={prices} toast={toast}/>,
    watchlist:<WatchlistPage user={user} watchlist={watchlist} prices={prices} onWatch={toggleWatch} onTrade={(sym)=>setPage("trade")}/>,
    database:<DatabasePage user={user} toast={toast}/>,
    settings:<SettingsPage user={user} theme={theme} setTheme={setTheme} toast={toast} onLogout={()=>{clearToken();setUser(null);setPortfolio({});setHistory([]);setWatchlist([]);setPage("dashboard");}}/>,
  };

  return (
    <div data-theme={theme} style={{minHeight:"100vh",background:"var(--bg)",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <GlobalStyles theme={theme}/>

      {/* Sidebar */}
      <div style={{position:"fixed",top:0,left:0,width:224,height:"100vh",background:"var(--card)",borderRight:"1px solid var(--brd)",display:"flex",flexDirection:"column",zIndex:100,padding:"22px 12px"}}>
        <div style={{padding:"0 10px 20px",borderBottom:"1px solid var(--brd)",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>📈</div>
            <div>
              <div style={{fontWeight:800,fontSize:16,color:"var(--t1)",letterSpacing:"-0.3px"}}>StockIQ</div>
              <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>Portfolio Intelligence</div>
            </div>
          </div>
        </div>

        <nav style={{flex:1,display:"flex",flexDirection:"column",gap:3,overflowY:"auto"}}>
          {NAV.map(item=>(
            <button key={item.id} onClick={()=>setPage(item.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,border:"none",cursor:"pointer",
                background:page===item.id?"rgba(99,102,241,0.15)":"transparent",
                color:page===item.id?"var(--acc)":"var(--t2)",
                fontSize:13,fontWeight:page===item.id?700:500,width:"100%",textAlign:"left",fontFamily:"inherit",transition:"all 0.15s"}}>
              <span style={{fontSize:15,width:20,textAlign:"center"}}>{item.icon}</span>
              {item.label}
              {page===item.id&&<div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"var(--acc)"}}/>}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div style={{borderTop:"1px solid var(--brd)",paddingTop:14,marginTop:8}}>
          <div style={{display:"flex",alignItems:"center",gap:9,padding:"0 4px"}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff",flexShrink:0}}>
              {user.username[0].toUpperCase()}
            </div>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.username}</div>
              <div style={{fontSize:10,color:"var(--t3)"}}>
                <LiveDot/>{Object.keys(portfolio).length} holdings
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{marginLeft:224,padding:"28px 28px 40px",minHeight:"100vh",maxWidth:"calc(100vw - 224px)"}}>
        {PAGES[page]||PAGES.dashboard}
      </div>

      <Toast toasts={toasts} remove={removeToast}/>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   GLOBAL STYLES
   ════════════════════════════════════════════════════════════════ */
function GlobalStyles({theme}){
  const dark=`--bg:#0d1117;--card:#161b22;--card2:#1c2128;--brd:rgba(255,255,255,0.08);--t1:#e6edf3;--t2:#8b949e;--t3:#484f58;--acc:#6366f1;`;
  const light=`--bg:#f0f4f8;--card:#ffffff;--card2:#f8fafc;--brd:rgba(0,0,0,0.08);--t1:#0d1117;--t2:#57606a;--t3:#8c959f;--acc:#6366f1;`;
  const vars=theme==="dark"?dark:light;
  return (
    <style>{`
      :root,body,[data-theme]{${vars}font-family:'DM Sans',system-ui,sans-serif;}
      body{background:var(--bg);color:var(--t1);margin:0;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:var(--bg);color:var(--t1);}
      input,select,textarea{background:var(--card2);border:1px solid var(--brd);color:var(--t1);border-radius:10px;padding:10px 14px;font-size:14px;outline:none;transition:border-color 0.2s;font-family:inherit;}
      input:focus,select:focus,textarea:focus{border-color:var(--acc);}
      input::placeholder{color:var(--t3);}
      button{cursor:pointer;font-family:inherit;transition:all 0.16s;}
      button:active{transform:scale(0.97);}
      ::-webkit-scrollbar{width:5px;height:5px;}
      ::-webkit-scrollbar-track{background:transparent;}
      ::-webkit-scrollbar-thumb{background:var(--brd);border-radius:5px;}
      .ani{animation:fadeUp 0.38s ease;}
      .btn-p{background:var(--acc);color:#fff;border:none;border-radius:10px;padding:11px 20px;font-weight:700;font-size:14px;}
      .btn-p:hover{opacity:0.88;}
      .btn-d{background:#ef4444;color:#fff;border:none;border-radius:10px;padding:11px 20px;font-weight:700;font-size:14px;}
      .btn-d:hover{opacity:0.88;}
      .btn-o{background:transparent;border:1px solid var(--brd);color:var(--t1);border-radius:10px;padding:9px 16px;font-weight:500;font-size:13px;}
      .btn-o:hover{border-color:var(--acc);color:var(--acc);}
      table{width:100%;border-collapse:collapse;}
      th{text-align:left;padding:10px 14px;font-size:11px;font-weight:700;color:var(--t3);border-bottom:1px solid var(--brd);text-transform:uppercase;letter-spacing:0.04em;}
      td{padding:12px 14px;font-size:13px;border-bottom:1px solid var(--brd);color:var(--t1);}
      tr:last-child td{border-bottom:none;}
      tr:hover td{background:rgba(99,102,241,0.04);}
    `}</style>
  );
}


/* ════════════════════════════════════════════════════════════════
   STOCK CHART — Line chart with SMA20, SMA50, RSI, volume bars
   ════════════════════════════════════════════════════════════════ */
function StockChart({sym, height}){
  height = height || 260;
  const [range,setRange]=useState(60);
  const s=STOCKS[sym]; if(!s) return null;
  const hist=useMemo(()=>genPriceHistory(sym,range),[sym,range]);
  const closes=hist.map(function(h){return h.close;});
  const volumes=hist.map(function(h){return h.volume;});
  const sma20=calcSMA(closes,20);
  const sma50=calcSMA(closes,50);
  const rsi=calcRSI(closes);
  if(hist.length<2) return null;
  const W=700,H=height,VH=50,PAD={t:10,r:10,b:30,l:60};
  const cW=W-PAD.l-PAD.r,cH=H-PAD.t-PAD.b-VH-10;
  const minP=Math.min(...closes)*0.995,maxP=Math.max(...closes)*1.005;
  const px=(i)=>PAD.l+i/(hist.length-1)*cW;
  const py=(v)=>PAD.t+cH-(v-minP)/(maxP-minP)*cH;
  const maxVol=Math.max(...volumes);
  const linePath=closes.map((v,i)=>`${i===0?"M":"L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const fillPath=linePath+` L${px(hist.length-1).toFixed(1)},${(PAD.t+cH).toFixed(1)} L${PAD.l},${(PAD.t+cH).toFixed(1)}Z`;
  const sma20Path=sma20.map((v,i)=>v===null?null:`${i===0||sma20[i-1]===null?"M":"L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).filter(Boolean).join(" ");
  const sma50Path=sma50.map((v,i)=>v===null?null:`${i===0||sma50[i-1]===null?"M":"L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).filter(Boolean).join(" ");
  const isUp=closes[closes.length-1]>=closes[0];
  const lineColor=isUp?"#22c55e":"#ef4444";
  const lastRsi=rsi[rsi.length-1]||50;
  const rsiColor=lastRsi>70?"#ef4444":lastRsi<30?"#22c55e":"#6366f1";
  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:8,fontSize:11}}>
          {[{c:"#22c55e",l:"SMA20"},{c:"#f59e0b",l:"SMA50"}].map(function(x){return(
            <span key={x.l} style={{display:"flex",alignItems:"center",gap:4,color:"var(--t2)"}}>
              <span style={{width:14,height:2,background:x.c,display:"inline-block",borderRadius:1}}/>{x.l}
            </span>
          );})}
          <span style={{fontSize:11,color:"var(--t2)"}}>|</span>
          <span style={{fontSize:11,fontWeight:600,color:rsiColor}}>RSI: {lastRsi}</span>
          <span style={{fontSize:11,color:lastRsi>70?"#ef4444":lastRsi<30?"#22c55e":"var(--t3)"}}>
            {lastRsi>70?"Overbought":lastRsi<30?"Oversold":"Neutral"}
          </span>
        </div>
        <div style={{display:"flex",gap:4}}>
          {[14,30,60,90].map(function(r){return(
            <button key={r} onClick={()=>setRange(r)}
              style={{padding:"3px 9px",borderRadius:6,border:"1px solid var(--brd)",fontSize:11,cursor:"pointer",fontFamily:"inherit",
                background:range===r?"var(--acc)":"transparent",color:range===r?"#fff":"var(--t2)"}}>
              {r}D
            </button>
          );})}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H+8}`} style={{width:"100%",display:"block"}} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`cg_${sym.replace(/[^a-zA-Z0-9]/g,"_")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.18"/>
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.01"/>
          </linearGradient>
        </defs>
        {[0,1,2,3,4].map(function(i){
          const v=minP+i*(maxP-minP)/4;
          const y=py(v);
          return (<g key={i}>
            <line x1={PAD.l} y1={y} x2={W-PAD.r} y2={y} stroke="var(--brd)" strokeWidth="0.5"/>
            <text x={PAD.l-6} y={y+4} textAnchor="end" fontSize="9" fill="var(--t3)">{v>=1000?`${(v/1000).toFixed(1)}k`:v.toFixed(0)}</text>
          </g>);
        })}
        {hist.map(function(h,i){
          const barW=Math.max(1,cW/hist.length-0.5);
          const bx=px(i)-barW/2;
          const by=PAD.t+cH+10+(1-(h.volume/maxVol))*VH;
          const bh=(h.volume/maxVol)*VH;
          const isGreen=i>0&&h.close>=hist[i-1].close;
          return <rect key={i} x={bx} y={by} width={barW} height={bh} fill={isGreen?"#22c55e30":"#ef444430"}/>;
        })}
        <path d={fillPath} fill={`url(#cg_${sym.replace(/[^a-zA-Z0-9]/g,"_")})`}/>
        {sma20Path&&<path d={sma20Path} fill="none" stroke="#22c55e" strokeWidth="1.2" strokeDasharray="4 2"/>}
        {sma50Path&&<path d={sma50Path} fill="none" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="4 2"/>}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={px(hist.length-1)} cy={py(closes[closes.length-1])} r="3.5" fill={lineColor}/>
        {[0,Math.floor(hist.length/3),Math.floor(hist.length*2/3),hist.length-1].map(function(i){return(
          <text key={i} x={px(i)} y={H-PAD.b+14} textAnchor="middle" fontSize="9" fill="var(--t3)">{hist[i]&&hist[i].date?hist[i].date.slice(5):""}</text>
        );})}
        <text x={PAD.l} y={PAD.t+cH+8} fontSize="8" fill="var(--t3)">VOL</text>
      </svg>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   STOCK DETAIL MODAL
   ════════════════════════════════════════════════════════════════ */
function StockDetailModal({sym,onClose,onBuyNav,onWatch,isWatched}){
  const s=STOCKS[sym]; if(!s) return null;
  const sig=useMemo(()=>getSignal(sym),[sym]);
  const price=livePrice(sym)||s.base;
  const change=liveChange(sym);
  const fromW52L=((price-s.w52l)/s.w52l*100).toFixed(1);
  const ratingColor={"Strong Buy":"#22c55e","Buy":"#6366f1","Hold":"#f59e0b","Sell":"#ef4444"}[sig&&sig.buySignal]||"#6366f1";
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
      onClick={function(e){if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:"var(--card)",borderRadius:18,padding:24,width:"100%",maxWidth:760,maxHeight:"90vh",overflowY:"auto",border:"1px solid var(--brd)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <span style={{fontWeight:800,fontSize:20}}>{sym}</span>
              <Badge color={SECTOR_COLORS[s.sector]||"#6366f1"}>{s.sector}</Badge>
              <span style={{padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700,background:`${ratingColor}20`,color:ratingColor}}>
                {sig&&sig.buySignal||"—"}
              </span>
            </div>
            <div style={{fontSize:13,color:"var(--t2)"}}>{s.name}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:24,fontWeight:800}}>{fmtC(price)}</div>
              <div style={{fontSize:13,color:change>=0?"#22c55e":"#ef4444",fontWeight:600}}>{fmtP(change)}</div>
            </div>
            <button onClick={onClose} style={{background:"var(--card2)",border:"1px solid var(--brd)",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:16,color:"var(--t2)"}}>✕</button>
          </div>
        </div>
        {sig&&sig.alerts&&sig.alerts.length>0&&(
          <div style={{marginBottom:14,display:"flex",flexDirection:"column",gap:5}}>
            {sig.alerts.map(function(a,i){
              const c={danger:"#ef4444",warn:"#f59e0b",info:"#6366f1",success:"#22c55e"}[a.type]||"#6366f1";
              return <div key={i} style={{padding:"8px 12px",borderRadius:8,background:`${c}12`,border:`1px solid ${c}28`,fontSize:12,color:c,fontWeight:500}}>{a.msg}</div>;
            })}
          </div>
        )}
        <Card style={{marginBottom:14}}><StockChart sym={sym}/></Card>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          {[
            {l:"P/E Ratio",v:s.pe,good:s.pe<25,bad:s.pe>60},
            {l:"ROE",v:`${s.roe}%`,good:s.roe>18,bad:s.roe<10},
            {l:"EPS",v:fmtC(s.eps)},
            {l:"Debt/Equity",v:s.debtEquity,good:s.debtEquity<0.5,bad:s.debtEquity>2},
            {l:"Div Yield",v:`${s.divYield}%`,good:s.divYield>2},
            {l:"Rev Growth",v:`${s.revenueGrowth}%`,good:s.revenueGrowth>12,bad:s.revenueGrowth<3},
            {l:"52W High",v:fmtC(s.w52h)},
            {l:"Volatility",v:`${s.volatility}%`,good:s.volatility<18,bad:s.volatility>=35},
          ].map(function(x){return(
            <div key={x.l} style={{background:"var(--card2)",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:10,color:"var(--t3)",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>{x.l}</div>
              <div style={{fontWeight:700,fontSize:15,color:x.good?"#22c55e":x.bad?"#ef4444":"var(--t1)"}}>{x.v}</div>
            </div>
          );})}
        </div>
        <div style={{marginBottom:14,padding:"12px 14px",background:"var(--card2)",borderRadius:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t3)",marginBottom:5}}>
            <span>52W Low: {fmtC(s.w52l)}</span>
            <span style={{fontWeight:600,color:"var(--t1)"}}>{fmtC(price)} ({fromW52L}% above low)</span>
            <span>52W High: {fmtC(s.w52h)}</span>
          </div>
          <div style={{height:6,background:"var(--brd)",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${Math.min(100,((price-s.w52l)/(s.w52h-s.w52l))*100)}%`,background:"var(--acc)",borderRadius:3}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-p" style={{flex:1,padding:12}} onClick={function(){onBuyNav(sym);onClose();}}>▲ Trade {sym.replace(".NS","")}</button>
          <button onClick={function(){onWatch(sym);}} style={{padding:"12px 20px",borderRadius:10,border:"1px solid var(--brd)",background:isWatched?"#6366f120":"transparent",color:isWatched?"#6366f1":"var(--t2)",fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {isWatched?"⭐ Watching":"☆ Watch"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MARKETS PAGE
   ════════════════════════════════════════════════════════════════ */
function MarketsPage({portfolio,prices,watchlist,onWatch,onTrade}){
  const [filter,setFilter]=useState("All");
  const [signalFilter,setSignalFilter]=useState("All");
  const [search,setSearch]=useState("");
  const [sortK,setSortK]=useState("mktCap");
  const [selectedSym,setSelectedSym]=useState(null);
  const sectors=useMemo(()=>["All",...Array.from(new Set(Object.values(STOCKS).filter(function(s){return s.sector!=="Index";}).map(function(s){return s.sector;}))).sort()],[]);
  const allStocks=useMemo(()=>
    Object.entries(STOCKS)
      .filter(function(e){return e[0]!=="^NSEI";})
      .map(function(e){
        const sym=e[0],s=e[1];
        const sig=getSignal(sym);
        const price=prices[sym]||livePrice(sym)||s.base;
        const change=liveChange(sym);
        return Object.assign({sym,price,change,signal:sig?sig.buySignal:"Hold",rsi:sig?sig.rsi:50,alerts:sig?sig.alerts:[]},s);
      })
      .filter(function(s){return filter==="All"||s.sector===filter;})
      .filter(function(s){return signalFilter==="All"||s.signal===signalFilter;})
      .filter(function(s){return !search||s.sym.toUpperCase().includes(search.toUpperCase())||s.name.toUpperCase().includes(search.toUpperCase());})
      .sort(function(a,b){
        if(sortK==="change") return b.change-a.change;
        if(sortK==="rsi") return b.rsi-a.rsi;
        if(sortK==="pe") return a.pe-b.pe;
        if(sortK==="roe") return b.roe-a.roe;
        return 0;
      })
  ,[filter,signalFilter,search,sortK,prices]);

  const SC={"Strong Buy":"#22c55e","Buy":"#6366f1","Hold":"#f59e0b","Sell":"#ef4444"};
  return (
    <div className="ani">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>📊 Markets</h1>
          <p style={{color:"var(--t2)",fontSize:14,marginTop:4}}>{allStocks.length} of 60 stocks · signals · fundamentals · charts</p>
        </div>
        <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="Search..." style={{padding:"8px 14px",borderRadius:10,width:180,fontSize:13}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        {["Strong Buy","Buy","Hold","Sell"].map(function(sig){
          const cnt=Object.keys(STOCKS).filter(function(k){return k!=="^NSEI";}).filter(function(k){return getSignal(k)&&getSignal(k).buySignal===sig;}).length;
          return <div key={sig} style={{background:"var(--card2)",border:"1px solid var(--brd)",borderRadius:12,padding:"12px 14px"}}>
            <div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>{sig}</div>
            <div style={{fontWeight:800,fontSize:22,color:SC[sig]}}>{cnt}<span style={{fontSize:12,fontWeight:400,color:"var(--t3)"}}> stocks</span></div>
          </div>;
        })}
      </div>
      <div style={{marginBottom:14,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {sectors.map(function(s){return(
            <button key={s} onClick={function(){setFilter(s);}}
              style={{padding:"5px 11px",borderRadius:20,border:"1px solid var(--brd)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                background:filter===s?"var(--acc)":"transparent",color:filter===s?"#fff":"var(--t2)"}}>
              {s}
            </button>
          );})}
        </div>
        <span style={{color:"var(--brd)"}}>|</span>
        {["All","Strong Buy","Buy","Hold","Sell"].map(function(s){
          const col=SC[s];
          return <button key={s} onClick={function(){setSignalFilter(s);}}
            style={{padding:"5px 11px",borderRadius:20,border:`1px solid ${s!=="All"&&col?col+"60":"var(--brd)"}`,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              background:signalFilter===s?(s!=="All"&&col?col+"20":"var(--acc)"):"transparent",
              color:signalFilter===s?(s!=="All"&&col?col:"#fff"):"var(--t2)"}}>
            {s}
          </button>;
        })}
        <div style={{marginLeft:"auto",display:"flex",gap:5,alignItems:"center",fontSize:11,color:"var(--t3)"}}>
          Sort:
          {[{k:"change",l:"Change"},{k:"roe",l:"ROE"},{k:"pe",l:"P/E"},{k:"rsi",l:"RSI"}].map(function(x){return(
            <button key={x.k} onClick={function(){setSortK(x.k);}}
              style={{padding:"4px 9px",borderRadius:6,border:"1px solid var(--brd)",fontSize:11,cursor:"pointer",fontFamily:"inherit",
                background:sortK===x.k?"var(--acc)":"transparent",color:sortK===x.k?"#fff":"var(--t2)"}}>
              {x.l}
            </button>
          );})}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(268px,1fr))",gap:10}}>
        {allStocks.map(function(stock){
          const sym=stock.sym,price=stock.price,change=stock.change,signal=stock.signal,rsi=stock.rsi,alerts=stock.alerts;
          const s=STOCKS[sym];
          const sc=SC[signal]||"#6366f1";
          const inPort=!!portfolio[sym];
          const pos52=s&&s.w52h&&s.w52l?Math.min(100,((price-s.w52l)/(s.w52h-s.w52l))*100):50;
          const hasVolWarn=alerts&&alerts.some(function(a){return a.type==="danger";});
          return (
            <div key={sym} onClick={function(){setSelectedSym(sym);}}
              style={{background:"var(--card)",border:`1px solid ${inPort?"rgba(99,102,241,0.4)":"var(--brd)"}`,borderRadius:14,padding:14,cursor:"pointer",transition:"all 0.15s",position:"relative"}}
              onMouseEnter={function(e){e.currentTarget.style.borderColor="var(--acc)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={function(e){e.currentTarget.style.borderColor=inPort?"rgba(99,102,241,0.4)":"var(--brd)";e.currentTarget.style.transform="none";}}>
              {hasVolWarn&&<div style={{position:"absolute",top:10,right:10,fontSize:12,color:"#f59e0b"}} title="High Volatility Warning">⚠</div>}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontWeight:800,fontSize:14}}>{sym.replace(".NS","")}</span>
                    {inPort&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:4,background:"rgba(99,102,241,0.15)",color:"var(--acc)",fontWeight:700}}>HELD</span>}
                  </div>
                  <div style={{fontSize:10,color:"var(--t3)",marginTop:1}}>{s&&s.name?s.name.slice(0,22):sym}</div>
                </div>
                <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:`${sc}18`,color:sc,fontWeight:700,whiteSpace:"nowrap"}}>{signal}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                <span style={{fontSize:18,fontWeight:800}}>{fmtC(price)}</span>
                <span style={{fontSize:12,color:change>=0?"#22c55e":"#ef4444",fontWeight:600}}>{fmtP(change)}</span>
              </div>
              {s&&s.w52h&&s.w52l&&<div style={{marginBottom:8}}>
                <div style={{height:4,background:"var(--brd)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pos52}%`,background:"var(--acc)",borderRadius:2}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--t3)",marginTop:2}}>
                  <span>{fmtC(s.w52l)}</span><span>{fmtC(s.w52h)}</span>
                </div>
              </div>}
              {s&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4,marginBottom:6}}>
                {[
                  {l:"P/E",v:s.pe,good:s.pe<25,bad:s.pe>60},
                  {l:"ROE",v:`${s.roe}%`,good:s.roe>18,bad:s.roe<10},
                  {l:"Vol%",v:`${s.volatility}%`,good:s.volatility<20,bad:s.volatility>=35},
                ].map(function(x){return(
                  <div key={x.l} style={{textAlign:"center",background:"var(--card2)",borderRadius:6,padding:"3px 0"}}>
                    <div style={{fontSize:9,color:"var(--t3)"}}>{x.l}</div>
                    <div style={{fontSize:11,fontWeight:700,color:x.good?"#22c55e":x.bad?"#ef4444":"var(--t1)"}}>{x.v}</div>
                  </div>
                );})}
              </div>}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:10,color:"var(--t3)"}}>RSI {rsi}</span>
                <div style={{flex:1,height:3,background:"var(--brd)",borderRadius:2}}>
                  <div style={{height:"100%",width:`${rsi}%`,background:rsi>70?"#ef4444":rsi<30?"#22c55e":"#6366f1",borderRadius:2}}/>
                </div>
                <span style={{fontSize:10,color:rsi>70?"#ef4444":rsi<30?"#22c55e":"var(--t3)"}}>
                  {rsi>70?"OB":rsi<30?"OS":""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {selectedSym&&(
        <StockDetailModal sym={selectedSym} onClose={function(){setSelectedSym(null);}}
          onBuyNav={function(sym){setSelectedSym(null);onTrade(sym);}}
          onWatch={onWatch} isWatched={watchlist.includes(selectedSym)}/>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DASHBOARD PAGE

   AUTO-REFRESH STRATEGY & JUSTIFICATION:
   ─────────────────────────────────────────
   • Live stock prices   → refresh every 7 seconds via setInterval in App shell.
     Reason: NSE intraday prices change frequently during market hours; 7 s
     balances data freshness with CPU / battery cost on the client device.

   • Portfolio history snapshot → written once per day (deduped by date key).
     Reason: Portfolio NAV is a daily metric — over-sampling wastes localStorage
     storage without adding analytical value to the time-series chart.

   • Database Manager view → refresh every 5 seconds (setInterval in DatabasePage).
     Reason: Allows multiple browser tabs / sessions to observe data changes
     without a manual page reload.

   • Risk score → recomputed reactively on every price tick (derived from
     portfolio + prices React state, no extra interval needed).
     Reason: Ensures the displayed risk score is always consistent with the
     latest live valuations.
   ════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════
   SECTOR P&L BAR CHART — Visualisation 3
   ════════════════════════════════════════════════════════════════ */
function SectorPnLChart({portfolio,prices}){
  const sectorData={};
  Object.entries(portfolio).forEach(([sym,h])=>{
    const sec=STOCKS[sym]?.sector||"Other";
    const cur=prices[sym]||h.avgPrice;
    if(!sectorData[sec]) sectorData[sec]={pnl:0,val:0};
    sectorData[sec].pnl+=(cur-h.avgPrice)*h.qty;
    sectorData[sec].val+=cur*h.qty;
  });
  const entries=Object.entries(sectorData).sort((a,b)=>b[1].pnl-a[1].pnl);
  if(!entries.length) return <div style={{color:"var(--t3)",fontSize:13,padding:"20px 0",textAlign:"center"}}>No holdings yet</div>;
  const maxAbs=Math.max(...entries.map(([,v])=>Math.abs(v.pnl)))||1;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {entries.map(([sec,{pnl,val}])=>{
        const pct=val?(pnl/val)*100:0;
        const isPos=pnl>=0;
        const barW=(Math.abs(pnl)/maxAbs)*100;
        return (
          <div key={sec} style={{display:"grid",gridTemplateColumns:"100px 1fr 90px 60px",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:5,overflow:"hidden"}}>
              <div style={{width:8,height:8,borderRadius:2,background:SECTOR_COLORS[sec]||"#6366f1",flexShrink:0}}/>
              <span style={{fontSize:11,fontWeight:600,color:"var(--t1)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sec}</span>
            </div>
            <div style={{height:18,background:"var(--card2)",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:barW+"%",background:isPos?"#22c55e":"#ef4444",borderRadius:4,opacity:0.8}}/>
            </div>
            <div style={{textAlign:"right",fontSize:11,fontWeight:700,color:isPos?"#22c55e":"#ef4444"}}>{isPos?"+":""}{fmtC(pnl)}</div>
            <div style={{textAlign:"right",fontSize:10,color:isPos?"#22c55e":"#ef4444",fontWeight:600}}>{isPos?"+":""}{fmt(pct,1)}%</div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardPage({portfolio,prices,risk,totalVal,totalPnL,totalPnLPct,history,user}){
  const [dateRange,setDateRange]=useState("30");
  const filteredHistory=history.filter((_,i,arr)=>{
    if(dateRange==="all") return true;
    const days=parseInt(dateRange);
    return i>=arr.length-days;
  });
  const n=Object.keys(portfolio).length;
  const niftyPrice=prices["^NSEI"]||livePrice("^NSEI")||22847;
  const niftyRet=((niftyPrice-22800)/22800)*100;
  const outperf=totalPnLPct-niftyRet;

  const topHoldings=Object.entries(portfolio)
    .map(([sym,h])=>({sym,...h,cur:prices[sym]||h.avgPrice,val:(prices[sym]||h.avgPrice)*h.qty}))
    .sort((a,b)=>b.val-a.val)
    .slice(0,5);

  return (
    <div className="ani">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:26}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,color:"var(--t1)",letterSpacing:"-0.5px"}}>Dashboard</h1>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"var(--t3)",marginTop:4}}>
            <LiveDot/>
            <span>Live market data · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</span>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:11,color:"var(--t3)",marginBottom:2}}>NIFTY 50</div>
          <div style={{fontSize:18,fontWeight:700}}>{fmtC(niftyPrice)}</div>
          <div style={{fontSize:12,color:niftyRet>=0?"#22c55e":"#ef4444",fontWeight:600}}>{fmtP(niftyRet)}</div>
        </div>
      </div>

      {/* Metric cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
        <MetricCard label="Portfolio Value"  value={fmtC(totalVal)}           sub={`${n} stock${n!==1?"s":""}`}     color="var(--acc)"  icon="💼"/>
        <MetricCard label="Total P&L"        value={`${totalPnL>=0?"+":""}${fmtC(Math.abs(totalPnL))}`} sub={fmtP(totalPnLPct)} color={totalPnL>=0?"#22c55e":"#ef4444"} icon={totalPnL>=0?"📈":"📉"} delta={totalPnLPct}/>
        <MetricCard label="Risk Score"       value={`${risk.score}/100`}       sub={`${risk.level} Risk`}            color={RC(risk.level)} icon="⚠️"/>
        <MetricCard label="vs NIFTY 50"      value={`${outperf>=0?"+":""}${fmt(outperf)}%`} sub={outperf>=0?"Outperforming":"Underperforming"} color={outperf>=0?"#22c55e":"#ef4444"} icon="📊"/>
      </div>

      {/* Charts row */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:18,marginBottom:18}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>Portfolio Value History</div>
              <div style={{fontSize:12,color:"var(--t3)"}}>Last {history.length} days</div>
            </div>
            {history.length>=2&&(
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:700,fontSize:15,color:totalPnL>=0?"#22c55e":"#ef4444"}}>{fmtC(totalVal)}</div>
                <div style={{fontSize:11,color:"var(--t3)"}}>Current value</div>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:4,marginBottom:8}}>
            {["7","14","30","60","all"].map(d=>(
              <button key={d} onClick={()=>setDateRange(d)}
                style={{padding:"3px 10px",borderRadius:14,border:"1px solid var(--brd)",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
                  background:dateRange===d?"var(--acc)":"transparent",color:dateRange===d?"#fff":"var(--t2)"}}>
                {d==="all"?"All":d+"D"}
              </button>
            ))}
          </div>
          <MiniLineChart data={filteredHistory} height={150} showDots/>
          {filteredHistory.length>=2&&<div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t3)",marginTop:6}}><span>{filteredHistory[0]?.date}</span><span>{filteredHistory[filteredHistory.length-1]?.date}</span></div>}
        </Card>

        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Sector Allocation</div>
          <div style={{fontSize:12,color:"var(--t3)",marginBottom:14}}>Portfolio distribution</div>
          {n>0?(
            <div>
              <DonutChart sectors={risk.sectors}/>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:14}}>
                {Object.entries(risk.sectors).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([s,p])=>(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:9,height:9,borderRadius:2,background:SECTOR_COLORS[s]||"#6366f1",flexShrink:0}}/>
                    <span style={{fontSize:12,color:"var(--t2)",flex:1}}>{s}</span>
                    <span style={{fontSize:12,fontWeight:700}}>{fmt(p,1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ):<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:140,color:"var(--t3)",fontSize:13}}>No holdings yet</div>}
        </Card>
      </div>

      {/* Risk + Insights row */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>Risk Analysis</div>
          <RiskGauge score={risk.score} level={risk.level}/>
          <div style={{marginTop:16,paddingTop:14,borderTop:"1px solid var(--brd)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"var(--card2)",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>Stocks</div>
              <div style={{fontWeight:700,fontSize:18}}>{n}</div>
              <div style={{fontSize:11,color:n<3?"#ef4444":n<5?"#f59e0b":"#22c55e"}}>{n<3?"High risk":n<5?"Medium":"Well diversified"}</div>
            </div>
            <div style={{background:"var(--card2)",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:11,color:"var(--t3)",marginBottom:4}}>Sectors</div>
              <div style={{fontWeight:700,fontSize:18}}>{Object.keys(risk.sectors).length}</div>
              <div style={{fontSize:11,color:"var(--t2)"}}>Categories</div>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>🧠 Smart Insights</div>
          {risk.insights.length>0?(
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {risk.insights.slice(0,4).map((ins,i)=>{
                const c={warning:"#f59e0b",danger:"#ef4444",info:"#6366f1",success:"#22c55e"}[ins.type]||"#6366f1";
                const ic={warning:"⚠️",danger:"🔴",info:"💡",success:"✅"}[ins.type]||"💡";
                return (
                  <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:10,background:`${c}12`,border:`1px solid ${c}28`}}>
                    <span style={{fontSize:14,flexShrink:0}}>{ic}</span>
                    <span style={{color:c,fontWeight:500,fontSize:12,lineHeight:1.5}}>{ins.msg}</span>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              <div style={{display:"flex",gap:10,padding:"10px 12px",borderRadius:10,background:"#6366f118",border:"1px solid #6366f128"}}>
                <span>💡</span><span style={{color:"#6366f1",fontSize:12}}>Add stocks to your portfolio to see personalized AI insights here.</span>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Visualisation 3: Sector P&L */}
      {n>0&&(
        <Card style={{marginBottom:18}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Sector Performance (P&L)</div>
          <div style={{fontSize:12,color:"var(--t3)",marginBottom:12}}>Unrealised gain / loss by sector</div>
          <SectorPnLChart portfolio={portfolio} prices={prices}/>
        </Card>
      )}

      {/* Top holdings table */}
      <Card pad={0} style={{overflow:"hidden"}}>
        <div style={{padding:"16px 20px",borderBottom:"1px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontWeight:700,fontSize:15}}>Top Holdings</div>
          <div style={{fontSize:12,color:"var(--t3)"}}>By portfolio weight</div>
        </div>
        {topHoldings.length>0?(
          <table>
            <thead><tr><th>Stock</th><th>Qty</th><th>Avg Cost</th><th>LTP</th><th>Value</th><th>P&L</th><th>Weight</th></tr></thead>
            <tbody>
              {topHoldings.map(h=>{
                const pnl=(h.cur-h.avgPrice)*h.qty;
                const pnlPct=((h.cur-h.avgPrice)/h.avgPrice)*100;
                const wt=(h.val/totalVal)*100;
                return (
                  <tr key={h.sym}>
                    <td><div style={{fontWeight:700}}>{h.sym}</div><div style={{fontSize:11,color:"var(--t3)"}}>{STOCKS[h.sym]?.sector}</div></td>
                    <td>{h.qty}</td>
                    <td>{fmtC(h.avgPrice)}</td>
                    <td><LiveDot/>{fmtC(h.cur)}</td>
                    <td style={{fontWeight:600}}>{fmtC(h.val)}</td>
                    <td style={{color:pnl>=0?"#22c55e":"#ef4444",fontWeight:700}}>
                      {pnl>=0?"+":""}{fmtC(pnl)}<br/>
                      <span style={{fontSize:11}}>{fmtP(pnlPct)}</span>
                    </td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:6,background:"var(--brd)",borderRadius:4,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${wt}%`,background:"var(--acc)",borderRadius:4}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:600,minWidth:32}}>{fmt(wt,1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ):(
          <div style={{padding:40,textAlign:"center"}}>
            <div style={{fontSize:40,marginBottom:12}}>📊</div>
            <div style={{fontWeight:700,fontSize:17,marginBottom:8}}>No holdings yet</div>
            <div style={{color:"var(--t2)",fontSize:13}}>Go to Trade to buy your first stock.</div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   PORTFOLIO PAGE
   ════════════════════════════════════════════════════════════════ */
function PortfolioPage({portfolio,prices,toast,onWatch,watchlist}){
  const [sortK,setSortK]=useState("value");
  const [sortD,setSortD]=useState(-1);
  const [filter,setFilter]=useState("All");

  const holdings=Object.entries(portfolio).map(([sym,h])=>{
    const cur=prices[sym]||h.avgPrice;
    const val=cur*h.qty, cost=h.avgPrice*h.qty;
    return {sym,...h,cur,val,pnl:val-cost,pnlPct:((cur-h.avgPrice)/h.avgPrice)*100,sector:STOCKS[sym]?.sector||"Other",name:STOCKS[sym]?.name||sym};
  });

  const sectors=["All",...new Set(holdings.map(h=>h.sector))];
  const filtered=holdings.filter(h=>filter==="All"||h.sector===filter);
  const sorted=[...filtered].sort((a,b)=>sortD*((b[sortK]||0)-(a[sortK]||0)));

  const totalVal=holdings.reduce((s,h)=>s+h.val,0);
  const totalPnL=holdings.reduce((s,h)=>s+h.pnl,0);
  const totalCost=holdings.reduce((s,h)=>s+h.qty*h.avgPrice,0);
  const totalPnLPct=totalCost?(totalPnL/totalCost)*100:0;

  const SH=(key,label)=>(
    <th style={{cursor:"pointer",userSelect:"none"}} onClick={()=>{setSortK(key);setSortD(s=>sortK===key?-s:-1);}}>
      {label} {sortK===key?(sortD===-1?"↓":"↑"):""}
    </th>
  );

  return (
    <div className="ani">
      <h1 style={{fontSize:24,fontWeight:800,marginBottom:22,letterSpacing:"-0.5px"}}>Portfolio</h1>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
        <MetricCard label="Total Value"    value={fmtC(totalVal)}     color="var(--acc)" icon="💼"/>
        <MetricCard label="Total Invested" value={fmtC(totalCost)}    color="var(--t2)"  icon="💰"/>
        <MetricCard label="Total P&L"      value={`${totalPnL>=0?"+":""}${fmtC(Math.abs(totalPnL))}`} color={totalPnL>=0?"#22c55e":"#ef4444"} icon={totalPnL>=0?"📈":"📉"} delta={totalPnLPct}/>
        <MetricCard label="Holdings"       value={holdings.length}    color="#06b6d4"    icon="📊"/>
      </div>

      {/* Sector filter */}
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
        {sectors.map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{padding:"6px 14px",borderRadius:20,border:"1px solid var(--brd)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              background:filter===s?"var(--acc)":"transparent",color:filter===s?"#fff":"var(--t2)"}}>
            {s}
          </button>
        ))}
      </div>

      <Card pad={0} style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr>{SH("sym","Symbol")}{SH("name","Name")}{SH("sector","Sector")}{SH("qty","Qty")}{SH("avgPrice","Avg Cost")}{SH("cur","LTP")}{SH("val","Value")}{SH("pnl","P&L")}{SH("pnlPct","Return")}<th>Actions</th></tr></thead>
            <tbody>
              {sorted.length===0?(
                <tr><td colSpan={10} style={{textAlign:"center",color:"var(--t3)",padding:40}}>No holdings. Go to Trade to add stocks.</td></tr>
              ):sorted.map(h=>(
                <tr key={h.sym}>
                  <td><div style={{fontWeight:700}}>{h.sym}</div></td>
                  <td style={{maxWidth:180}}><div style={{color:"var(--t2)",fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div></td>
                  <td><Badge color={SECTOR_COLORS[h.sector]||"#6366f1"}>{h.sector}</Badge></td>
                  <td>{h.qty}</td>
                  <td>{fmtC(h.avgPrice)}</td>
                  <td><LiveDot/>{fmtC(h.cur)}</td>
                  <td style={{fontWeight:700}}>{fmtC(h.val)}</td>
                  <td style={{color:h.pnl>=0?"#22c55e":"#ef4444",fontWeight:700}}>{h.pnl>=0?"+":""}{fmtC(h.pnl)}</td>
                  <td style={{color:h.pnlPct>=0?"#22c55e":"#ef4444",fontWeight:700}}>{fmtP(h.pnlPct)}</td>
                  <td>
                    <button onClick={()=>onWatch(h.sym)}
                      style={{background:"none",border:"none",fontSize:16,cursor:"pointer",opacity:watchlist.includes(h.sym)?1:0.4,transition:"opacity 0.2s"}} title={watchlist.includes(h.sym)?"Remove from watchlist":"Add to watchlist"}>
                      ⭐
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TRADE PAGE
   ════════════════════════════════════════════════════════════════ */
function TradePage({portfolio,prices,onBuy,onSell,watchlist,onWatch}){
  const [mode,setMode]=useState("buy");
  const [selected,setSelected]=useState(null);
  const [lp,setLp]=useState(null);
  const [qty,setQty]=useState("");
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(!selected) return;
    setLp(livePrice(selected.symbol));
    const iv=setInterval(()=>setLp(livePrice(selected.symbol)),4000);
    return ()=>clearInterval(iv);
  },[selected]);

  const holding=selected?portfolio[selected.symbol]:null;
  const total=qty&&lp?+qty*lp:0;
  const maxSell=holding?.qty||0;

  const submit=async()=>{
    if(!selected||!qty||+qty<=0) return;
    setLoading(true);
    await new Promise(r=>setTimeout(r,600));
    if(mode==="buy") onBuy(selected.symbol,+qty,lp);
    else onSell(selected.symbol,+qty,lp);
    setQty(""); setLoading(false);
  };

  const POPULAR=["RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFY.NS","SUNPHARMA.NS","MARUTI.NS","BAJFINANCE.NS","WIPRO.NS"];

  return (
    <div className="ani">
      <h1 style={{fontSize:24,fontWeight:800,marginBottom:22,letterSpacing:"-0.5px"}}>Trade</h1>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:20,alignItems:"start"}}>
        {/* Left: form */}
        <div>
          <Card style={{marginBottom:18}}>
            {/* Buy/Sell toggle */}
            <div style={{display:"flex",gap:4,marginBottom:22,background:"var(--bg)",borderRadius:11,padding:5}}>
              {["buy","sell"].map(m=>(
                <button key={m} onClick={()=>setMode(m)}
                  style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",
                    background:mode===m?(m==="buy"?"#22c55e":"#ef4444"):"transparent",
                    color:mode===m?"#fff":"var(--t2)",transition:"all 0.2s"}}>
                  {m==="buy"?"▲ Buy":"▼ Sell"}
                </button>
              ))}
            </div>

            <div style={{marginBottom:18}}>
              <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:600}}>Search Stock</label>
              <StockSearch onSelect={s=>{setSelected(s);}} placeholder="Search NSE stocks e.g. RELIANCE.NS"/>
            </div>

            {/* Stock preview */}
            {selected&&lp&&(
              <div style={{padding:16,borderRadius:12,background:"var(--card2)",border:"1px solid var(--brd)",marginBottom:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:16}}>{selected.symbol}</div>
                    <div style={{fontSize:12,color:"var(--t3)",marginBottom:8}}>{selected.name||STOCKS[selected.symbol]?.name}</div>
                    <Badge color={SECTOR_COLORS[selected.sector]||"#6366f1"}>{selected.sector||STOCKS[selected.symbol]?.sector}</Badge>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:22,fontWeight:800}}><LiveDot/>{fmtC(lp)}</div>
                    <div style={{fontSize:12,color:liveChange(selected.symbol)>=0?"#22c55e":"#ef4444",fontWeight:600,marginTop:2}}>{fmtP(liveChange(selected.symbol))}</div>
                    {STOCKS[selected.symbol]&&<div style={{fontSize:11,color:"var(--t3)",marginTop:4}}>P/E: {STOCKS[selected.symbol].pe} · {STOCKS[selected.symbol].mktCap}</div>}
                  </div>
                </div>
                {holding&&(
                  <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--brd)",display:"flex",gap:16,fontSize:12}}>
                    <div><span style={{color:"var(--t3)"}}>You hold: </span><span style={{fontWeight:700}}>{holding.qty} shares</span></div>
                    <div><span style={{color:"var(--t3)"}}>Avg: </span><span style={{fontWeight:700}}>{fmtC(holding.avgPrice)}</span></div>
                    <div><span style={{color:"var(--t3)"}}>P&L: </span><span style={{fontWeight:700,color:(lp-holding.avgPrice)>=0?"#22c55e":"#ef4444"}}>{fmtP(((lp-holding.avgPrice)/holding.avgPrice)*100)}</span></div>
                  </div>
                )}
              </div>
            )}

            <div style={{marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <label style={{fontSize:12,color:"var(--t2)",fontWeight:600}}>Quantity</label>
                {mode==="sell"&&holding&&<span style={{fontSize:11,color:"var(--t3)"}}>Max: {maxSell}</span>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <input type="number" min="1" max={mode==="sell"?maxSell:undefined} value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" style={{flex:1}}/>
                {mode==="sell"&&holding&&(
                  <button className="btn-o" onClick={()=>setQty(String(maxSell))} style={{whiteSpace:"nowrap",fontSize:12}}>Sell All</button>
                )}
              </div>
            </div>

            {total>0&&(
              <div style={{padding:"12px 16px",borderRadius:10,background:"var(--card2)",border:"1px solid var(--brd)",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{color:"var(--t2)",fontSize:13}}>Est. {mode==="buy"?"Cost":"Proceeds"}</span>
                <span style={{fontWeight:800,fontSize:20,color:mode==="buy"?"#6366f1":"#22c55e"}}>{fmtC(total)}</span>
              </div>
            )}

            <button onClick={submit} disabled={loading||!selected||!qty||+qty<=0}
              style={{width:"100%",padding:14,borderRadius:10,border:"none",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit",
                background:mode==="buy"?"#22c55e":"#ef4444",color:"#fff",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                opacity:(!selected||!qty||+qty<=0)?0.55:1,transition:"opacity 0.2s"}}>
              {loading?<Spinner/>:`${mode==="buy"?"▲ Buy":"▼ Sell"} ${qty||""} ${selected?.symbol||"Stock"}`}
            </button>
          </Card>
        </div>

        {/* Right: popular + watchlist */}
        <div style={{display:"flex",flexDirection:"column",gap:18}}>
          <Card>
            <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Popular NSE Stocks</div>
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {POPULAR.map(sym=>{
                const p=livePrice(sym)||STOCKS[sym]?.base||0;
                const ch=liveChange(sym);
                return (
                  <div key={sym} onClick={()=>setSelected({symbol:sym,...STOCKS[sym]})}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--brd)",cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.05)"}
                    onMouseLeave={e=>e.currentTarget.style.background=""}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13}}>{sym}</div>
                      <div style={{fontSize:11,color:"var(--t3)"}}>{STOCKS[sym]?.sector}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontWeight:700,fontSize:13}}>{fmtC(p)}</div>
                      <div style={{fontSize:11,color:ch>=0?"#22c55e":"#ef4444",fontWeight:600}}>{fmtP(ch)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SIMULATE PAGE
   ════════════════════════════════════════════════════════════════ */
function SimulatePage({portfolio,prices,risk,toast,user}){
  const [selected,setSelected]=useState(null);
  const [amount,setAmount]=useState("");
  const [results,setResults]=useState(null);
  const [loading,setLoading]=useState(false);
  const [aiInsight,setAiInsight]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [history,setHistory]=useState([]);
  useEffect(()=>{
    apiFetch("/simulations").then(d=>setHistory(d||[])).catch(()=>{});
  },[]);

  const simulate=async()=>{
    if(!selected||!amount||+amount<=0){toast("Select a stock and enter amount","error");return;}
    setLoading(true);
    await new Promise(r=>setTimeout(r,700));
    const price=livePrice(selected.symbol)||STOCKS[selected.symbol]?.base||1000;
    const qty=Math.floor(+amount/price);
    if(qty<1){toast("Amount too low for 1 share","error");setLoading(false);return;}

    const beforeRisk=calcRisk(portfolio,prices);
    const simP={...portfolio};
    const h=simP[selected.symbol];
    if(h){const tq=h.qty+qty; simP[selected.symbol]={qty:tq,avgPrice:(h.avgPrice*h.qty+price*qty)/tq};}
    else simP[selected.symbol]={qty,avgPrice:price};
    const simPrices={...prices,[selected.symbol]:price};
    const afterRisk=calcRisk(simP,simPrices);
    const beforeVal=Object.entries(portfolio).reduce((s,[sym,h])=>s+h.qty*(prices[sym]||h.avgPrice),0);
    const afterVal=Object.entries(simP).reduce((s,[sym,h])=>s+h.qty*(simPrices[sym]||h.avgPrice),0);

    const res={before:{risk:beforeRisk,val:beforeVal},after:{risk:afterRisk,val:afterVal},symbol:selected.symbol,qty,price,amount:qty*price};
    setResults(res);
    try{
      await apiFetch("/simulations",{method:"POST",body:JSON.stringify({symbol:selected.symbol,amount:+amount,qty,price,before_score:beforeRisk.score,after_score:afterRisk.score})});
      apiFetch("/simulations").then(d=>setHistory(d||[]));
    }catch(e){ console.error("Sim save failed:",e.message); }
    setLoading(false);

    // AI insight
    setAiInsight(""); setAiLoading(true);
    try{
      const prompt=`You are a concise Indian stock market portfolio advisor. User is simulating adding ${qty} shares of ${selected.symbol} (${STOCKS[selected.symbol]?.name}, sector: ${STOCKS[selected.symbol]?.sector}) worth ₹${fmt(qty*price)} to their portfolio.
Before: ${Object.keys(portfolio).length} stocks, risk ${beforeRisk.score}/100 (${beforeRisk.level}).
After: ${Object.keys(simP).length} stocks, risk ${afterRisk.score}/100 (${afterRisk.level}).
Sectors before: ${JSON.stringify(beforeRisk.sectors)}.
Sectors after: ${JSON.stringify(afterRisk.sectors)}.
Give 2-3 sharp, specific insights about this decision. Focus on diversification impact, sector exposure change, and risk. Use Indian market context. Be direct, max 3 sentences.`;
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":"PLACEHOLDER",
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true"
        },
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:250,messages:[{role:"user",content:prompt}]})
      });
      const data=await resp.json();
      if(data.error) throw new Error(data.error.message||"API error");
      setAiInsight(data.content?.[0]?.text||"No insight returned.");
    }catch(e){setAiInsight(`AI advisor temporarily unavailable: ${e.message||"Unknown error"}`);}
    setAiLoading(false);
  };

  return (
    <div className="ani" style={{maxWidth:800}}>
      <h1 style={{fontSize:24,fontWeight:800,marginBottom:6,letterSpacing:"-0.5px"}}>Investment Simulator</h1>
      <p style={{color:"var(--t2)",fontSize:14,marginBottom:22}}>Simulate an investment and see the Before vs After impact on your portfolio.</p>

      <Card style={{marginBottom:22}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
          <div>
            <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:600}}>Stock to Add</label>
            <StockSearch onSelect={s=>setSelected(s)} placeholder="e.g. INFY.NS"/>
            {selected&&<div style={{marginTop:8,fontSize:12,color:"var(--t2)"}}>
              <span style={{color:SECTOR_COLORS[selected.sector]||"var(--acc)",fontWeight:600}}>■</span> {selected.name||STOCKS[selected.symbol]?.name} · {fmtC(livePrice(selected.symbol)||STOCKS[selected.symbol]?.base)}
            </div>}
          </div>
          <div>
            <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:600}}>Investment Amount (₹)</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 50000"/>
            {selected&&amount>0&&<div style={{marginTop:8,fontSize:12,color:"var(--t3)"}}>
              ≈ {Math.floor(+amount/(livePrice(selected.symbol)||STOCKS[selected.symbol]?.base||1))} shares
            </div>}
          </div>
        </div>
        <button className="btn-p" onClick={simulate} disabled={loading||!selected||!amount}
          style={{display:"flex",alignItems:"center",gap:8,opacity:(!selected||!amount)?0.55:1}}>
          {loading?<Spinner/>:"◈ Run Simulation"}
        </button>
      </Card>

      {results&&(
        <div className="ani">
          {/* Before / After */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
            {[
              {label:"BEFORE",data:results.before,accent:"#6366f1"},
              {label:`AFTER  (+${results.qty} ${results.symbol})`,data:results.after,accent:"#22c55e",isAfter:true}
            ].map(({label,data,accent,isAfter})=>(
              <Card key={label} style={{borderTop:`3px solid ${accent}`}}>
                <div style={{fontSize:11,fontWeight:800,color:accent,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:16}}>{label}</div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:"var(--t3)",marginBottom:3}}>Portfolio Value</div>
                  <div style={{fontSize:22,fontWeight:800}}>{fmtC(data.val)}</div>
                  {isAfter&&<div style={{fontSize:12,color:"#22c55e",fontWeight:600,marginTop:2}}>+{fmtC(data.val-results.before.val)}</div>}
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:"var(--t3)",marginBottom:6}}>Risk Score</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{flex:1,height:7,background:"var(--brd)",borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${data.risk.score}%`,background:`linear-gradient(90deg,#22c55e,#f59e0b 50%,#ef4444)`,borderRadius:4,transition:"width 0.8s"}}/>
                    </div>
                    <span style={{fontWeight:800,color:RC(data.risk.level),minWidth:40}}>{data.risk.score}/100</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:RC(data.risk.level)}}>
                    {data.risk.level} Risk
                    {isAfter&&data.risk.score!==results.before.risk.score&&(
                      <span style={{marginLeft:8,color:data.risk.score<results.before.risk.score?"#22c55e":"#ef4444",fontSize:12}}>
                        {data.risk.score<results.before.risk.score?"▼":"▲"} {Math.abs(data.risk.score-results.before.risk.score)} pts
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11,color:"var(--t3)",marginBottom:8}}>Sector Distribution</div>
                  {Object.entries(data.risk.sectors).sort((a,b)=>b[1]-a[1]).map(([s,p])=>{
                    const was=isAfter?(results.before.risk.sectors[s]||0):null;
                    const diff=was!=null?p-was:null;
                    return (
                      <div key={s} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                        <div style={{width:8,height:8,borderRadius:2,background:SECTOR_COLORS[s]||"#6366f1",flexShrink:0}}/>
                        <span style={{fontSize:12,color:"var(--t2)",flex:1}}>{s}</span>
                        <span style={{fontSize:12,fontWeight:700}}>{fmt(p,1)}%</span>
                        {diff!=null&&diff!==0&&<span style={{fontSize:10,color:diff>2?"#ef4444":"#22c55e",fontWeight:600}}>({diff>0?"+":""}{fmt(diff,1)}%)</span>}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          {/* AI */}
          <Card>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
              <span>🤖</span> AI Portfolio Advisor
            </div>
            {aiLoading?(
              <div style={{display:"flex",gap:12,alignItems:"center",color:"var(--t2)",fontSize:13,padding:"12px 0"}}>
                <Spinner size={18} color="var(--acc)"/>Analyzing your portfolio...
              </div>
            ):aiInsight?(
              <p style={{color:"var(--t1)",fontSize:14,lineHeight:1.75,padding:"14px 16px",borderRadius:12,background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.18)"}}>{aiInsight}</p>
            ):<div style={{color:"var(--t3)",fontSize:13}}>No AI insight available.</div>}
          </Card>
        </div>
      )}

      {/* Simulation history */}
      {history.length>0&&(
        <div style={{marginTop:22}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>Recent Simulations</div>
          <Card pad={0} style={{overflow:"hidden"}}>
            <table>
              <thead><tr><th>Date</th><th>Stock</th><th>Amount</th><th>Qty</th><th>Risk Before</th><th>Risk After</th><th>Change</th></tr></thead>
              <tbody>
                {history.slice(0,8).map(s=>(
                  <tr key={s.id}>
                    <td style={{fontSize:12,color:"var(--t3)"}}>{new Date(s.created_at||s.date).toLocaleDateString("en-IN")}</td>
                    <td style={{fontWeight:700}}>{s.symbol}</td>
                    <td>{fmtC(s.amount)}</td>
                    <td>{s.qty}</td>
                    <td><span style={{color:RC(s.before_score||s.beforeScore||0>=70?"High":s.before_score||s.beforeScore||0>=40?"Medium":"Low"),fontWeight:600}}>{s.before_score||s.beforeScore||0}/100</span></td>
                    <td><span style={{color:RC(s.after_score||s.afterScore||0>=70?"High":s.after_score||s.afterScore||0>=40?"Medium":"Low"),fontWeight:600}}>{s.after_score||s.afterScore||0}/100</span></td>
                    <td style={{color:(s.after_score||s.afterScore||0-s.before_score||s.beforeScore||0)<=0?"#22c55e":"#ef4444",fontWeight:700}}>
                      {(s.after_score||s.afterScore||0-s.before_score||s.beforeScore||0)<=0?"▼":"▲"} {Math.abs(s.after_score||s.afterScore||0-s.before_score||s.beforeScore||0)} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TRANSACTIONS PAGE
   ════════════════════════════════════════════════════════════════ */
function TransactionsPage({user,portfolio,prices,toast}){
  const [txns,setTxns]=useState([]);
  useEffect(()=>{
    apiFetch("/transactions?limit=500").then(d=>setTxns(d||[])).catch(()=>{});
  },[]);
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [confirm,setConfirm]=useState(null);

  const filtered=txns.filter(t=>{
    if(filter!=="all"&&t.type!==filter) return false;
    if(search&&!t.symbol.includes(search.toUpperCase())) return false;
    return true;
  });

  const buys=txns.filter(t=>t.type==="buy");
  const sells=txns.filter(t=>t.type==="sell");
  const totalBuyVal=buys.reduce((s,t)=>s+t.qty*t.price,0);
  const totalSellVal=sells.reduce((s,t)=>s+t.qty*t.price,0);

  const delTxn=async(id)=>{
    try{
      await apiFetch("/transactions/"+id,{method:"DELETE"});
      setTxns(t=>t.filter(x=>x.id!==id));
      toast("Transaction deleted","info");
    }catch(e){ toast("Delete failed: "+e.message,"error"); }
    setConfirm(null);
  };

  const exportCSV=()=>{
    const rows=["Date,Type,Symbol,Qty,Price,Total",...txns.map(t=>`${new Date(t.created_at||t.date).toLocaleDateString("en-IN")},${t.type},${t.symbol},${t.qty},${t.price},${t.qty*t.price}`)];
    const blob=new Blob([rows.join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="stockiq_transactions.csv"; a.click();
    toast("Transactions exported as CSV","success");
  };

  return (
    <div className="ani">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>Transactions</h1>
          <p style={{color:"var(--t2)",fontSize:14,marginTop:4}}>{txns.length} total transactions</p>
        </div>
        <button className="btn-o" onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:6}}>⬇ Export CSV</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
        <MetricCard label="Total Buys"  value={buys.length}        color="#22c55e" icon="▲"/>
        <MetricCard label="Total Sells" value={sells.length}       color="#ef4444" icon="▼"/>
        <MetricCard label="Buy Value"   value={fmtC(totalBuyVal)}  color="#22c55e" icon="💰"/>
        <MetricCard label="Sell Value"  value={fmtC(totalSellVal)} color="#ef4444" icon="💸"/>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        {["all","buy","sell"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:"6px 16px",borderRadius:20,border:"1px solid var(--brd)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",
              background:filter===f?"var(--acc)":"transparent",color:filter===f?"#fff":"var(--t2)"}}>
            {f==="all"?"All":f==="buy"?"Buys":"Sells"}
          </button>
        ))}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter by symbol..." style={{padding:"6px 12px",fontSize:12,borderRadius:20,flex:1,maxWidth:200}}/>
      </div>

      <Card pad={0} style={{overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>Date & Time</th><th>Type</th><th>Symbol</th><th>Name</th><th>Qty</th><th>Price</th><th>Total</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={8} style={{textAlign:"center",color:"var(--t3)",padding:40}}>No transactions found.</td></tr>
              ):filtered.map(t=>{
                const cur=prices[t.symbol]||t.price;
                const pnlOnSell=t.type==="sell"?(t.price-(portfolio[t.symbol]?.avgPrice||t.price))*t.qty:null;
                return (
                  <tr key={t.id}>
                    <td style={{fontSize:12,color:"var(--t3)"}}>{new Date(t.created_at||t.date).toLocaleString("en-IN",{day:"2-digit",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
                    <td>
                      <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                        background:t.type==="buy"?"#22c55e20":"#ef444420",color:t.type==="buy"?"#22c55e":"#ef4444"}}>
                        {t.type==="buy"?"▲ BUY":"▼ SELL"}
                      </span>
                    </td>
                    <td style={{fontWeight:700}}>{t.symbol}</td>
                    <td style={{color:"var(--t2)",fontSize:12}}>{STOCKS[t.symbol]?.name||"—"}</td>
                    <td>{t.qty}</td>
                    <td>{fmtC(t.price)}</td>
                    <td style={{fontWeight:700}}>{fmtC(t.qty*t.price)}</td>
                    <td>
                      {confirm===t.id?(
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>delTxn(t.id)} style={{padding:"3px 8px",borderRadius:6,background:"#ef4444",color:"#fff",border:"none",fontSize:11,cursor:"pointer"}}>Yes</button>
                          <button onClick={()=>setConfirm(null)} style={{padding:"3px 8px",borderRadius:6,background:"var(--card2)",color:"var(--t2)",border:"1px solid var(--brd)",fontSize:11,cursor:"pointer"}}>No</button>
                        </div>
                      ):(
                        <button onClick={()=>setConfirm(t.id)} style={{background:"none",border:"none",color:"var(--t3)",fontSize:14,cursor:"pointer"}} title="Delete">🗑</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   WATCHLIST PAGE
   ════════════════════════════════════════════════════════════════ */
function WatchlistPage({user,watchlist,prices,onWatch,onTrade}){
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState(null);

  const items=watchlist.map(sym=>({sym,price:prices[sym]||livePrice(sym)||STOCKS[sym]?.base||0,change:liveChange(sym),...STOCKS[sym]}));

  return (
    <div className="ani">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>Watchlist</h1>
          <p style={{color:"var(--t2)",fontSize:14,marginTop:4}}>{watchlist.length} stocks tracked</p>
        </div>
      </div>

      <Card style={{marginBottom:18}}>
        <div style={{fontWeight:600,fontSize:14,marginBottom:12}}>Add to Watchlist</div>
        <StockSearch onSelect={s=>{onWatch(s.symbol);}} placeholder="Search and add stocks..."/>
      </Card>

      {items.length===0?(
        <Card style={{textAlign:"center",padding:48}}>
          <div style={{fontSize:40,marginBottom:12}}>⭐</div>
          <div style={{fontWeight:700,fontSize:17,marginBottom:8}}>Watchlist is empty</div>
          <div style={{color:"var(--t2)",fontSize:13}}>Search and add stocks above to start watching them.</div>
        </Card>
      ):(
        <Card pad={0} style={{overflow:"hidden"}}>
          <table>
            <thead><tr><th>Symbol</th><th>Name</th><th>Sector</th><th>LTP</th><th>Change</th><th>P/E</th><th>Mkt Cap</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map(item=>(
                <tr key={item.sym}>
                  <td style={{fontWeight:700}}>{item.sym}</td>
                  <td style={{color:"var(--t2)",fontSize:12}}>{item.name}</td>
                  <td><Badge color={SECTOR_COLORS[item.sector]||"#6366f1"}>{item.sector}</Badge></td>
                  <td><LiveDot/><span style={{fontWeight:700}}>{fmtC(item.price)}</span></td>
                  <td style={{color:item.change>=0?"#22c55e":"#ef4444",fontWeight:700}}>{fmtP(item.change)}</td>
                  <td style={{color:"var(--t2)"}}>{item.pe}</td>
                  <td style={{color:"var(--t2)",fontSize:12}}>{item.mktCap}</td>
                  <td>
                    <div style={{display:"flex",gap:8}}>
                      <button className="btn-p" style={{padding:"4px 10px",fontSize:12,borderRadius:6}} onClick={()=>onTrade(item.sym)}>Trade</button>
                      <button onClick={()=>onWatch(item.sym)} style={{background:"none",border:"1px solid var(--brd)",borderRadius:6,padding:"4px 8px",fontSize:12,color:"var(--t3)",cursor:"pointer"}}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   RISK ANALYSIS PAGE  — full dedicated page
   ════════════════════════════════════════════════════════════════ */
function RiskAnalysisPage({portfolio,prices,risk,user,totalVal,history}){
  const [aiReport,setAiReport]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [snapshots,setSnapshots]=useState([]);
  useEffect(()=>{
    apiFetch("/risk").then(d=>setSnapshots(d||[])).catch(()=>{});
  },[]);
  const [activeTab,setActiveTab]=useState("overview");

  const holdings=Object.entries(portfolio).map(([sym,h])=>{
    const cur=prices[sym]||h.avgPrice;
    const val=cur*h.qty;
    const weight=totalVal?((val/totalVal)*100):0;
    const pnlPct=((cur-h.avgPrice)/h.avgPrice)*100;
    return {sym,qty:h.qty,avgPrice:h.avgPrice,cur,val,weight,pnlPct,
      sector:STOCKS[sym]?.sector||"Other",name:STOCKS[sym]?.name||sym,pe:STOCKS[sym]?.pe||0};
  });

  // ── Risk sub-scores ──────────────────────────────────────────
  const n=holdings.length;
  const sectorCount=Object.keys(risk.sectors).length;
  const maxWeight=holdings.length?Math.max(...holdings.map(h=>h.weight)):0;
  const maxSectorPct=Object.values(risk.sectors).length?Math.max(...Object.values(risk.sectors)):0;

  const diversScore = clamp(n<3?10:n<5?35:n<8?60:n<12?80:95, 0,100);
  const concentScore= clamp(maxSectorPct>60?15:maxSectorPct>45?35:maxSectorPct>30?60:maxSectorPct>20?80:95, 0,100);
  const stockConcScore=clamp(maxWeight>40?20:maxWeight>25?45:maxWeight>15?70:90, 0,100);
  const sectorDivScore=clamp(sectorCount<=1?10:sectorCount===2?30:sectorCount===3?55:sectorCount===4?75:90, 0,100);

  const subScores=[
    {label:"Diversification",    score:diversScore,    icon:"🔀", desc:`${n} stock${n!==1?"s":""} in portfolio`,       tip:n<5?"Add more stocks to reduce concentration risk":"Good number of holdings"},
    {label:"Sector Spread",      score:sectorDivScore, icon:"🏭", desc:`${sectorCount} sector${sectorCount!==1?"s":""}`,tip:sectorCount<3?"Portfolio spread across too few sectors":"Healthy sector distribution"},
    {label:"Sector Concentration",score:concentScore,  icon:"📊", desc:`Max sector: ${fmt(maxSectorPct,1)}%`,          tip:maxSectorPct>45?"Single sector dominates portfolio":"Good sector balance"},
    {label:"Stock Concentration", score:stockConcScore, icon:"🎯", desc:`Top holding: ${fmt(maxWeight,1)}%`,           tip:maxWeight>30?"Single stock carries too much weight":"Position sizing looks healthy"},
  ];

  // ── Risk breakdown by holding ────────────────────────────────
  const holdingRisk=holdings.map(h=>{
    let score=50;
    if(h.weight>30) score+=25;
    else if(h.weight>20) score+=15;
    else if(h.weight<8) score-=10;
    const volStocks=["ADANIENT.NS","BAJFINANCE.NS","TATAMOTORS.NS","JSWSTEEL.NS"];
    if(volStocks.includes(h.sym)) score+=10;
    const defensiveStocks=["HINDUNILVR.NS","NESTLEIND.NS","POWERGRID.NS","NTPC.NS","SUNPHARMA.NS"];
    if(defensiveStocks.includes(h.sym)) score-=10;
    return {...h, riskScore:clamp(score,0,100), riskLevel:score>=70?"High":score>=40?"Medium":"Low"};
  }).sort((a,b)=>b.riskScore-a.riskScore);

  // ── Save snapshot ────────────────────────────────────────────
  const saveSnapshot=async()=>{
    try{
      await apiFetch("/risk",{method:"POST",body:JSON.stringify({score:risk.score,level:risk.level,holdings:n})});
      apiFetch("/risk").then(d=>setSnapshots(d||[]));
    }catch(e){ toast("Snapshot save failed: "+e.message,"error"); }
  };

  // ── AI Full Report ───────────────────────────────────────────
  const generateReport=async()=>{
    if(!n){return;}
    setAiLoading(true); setAiReport("");
    try{
      const holdingsSummary=holdings.map(h=>`${h.sym}(${STOCKS[h.sym]?.sector}): ${fmt(h.weight,1)}% weight, ${fmtP(h.pnlPct)} P&L`).join("; ");
      const prompt=`You are a senior Indian equity portfolio analyst. Provide a comprehensive risk analysis report for this portfolio.

Portfolio Summary:
- Total Value: ₹${fmt(totalVal)}
- Total Holdings: ${n} stocks
- Risk Score: ${risk.score}/100 (${risk.level} Risk)
- Sectors: ${Object.entries(risk.sectors).map(([s,p])=>`${s}: ${fmt(p,1)}%`).join(", ")}
- Holdings: ${holdingsSummary}

Sub-scores:
- Diversification: ${diversScore}/100
- Sector Spread: ${sectorDivScore}/100
- Sector Concentration: ${concentScore}/100
- Stock Concentration: ${stockConcScore}/100

Provide a detailed analysis covering:
1. Overall Risk Assessment (2-3 sentences)
2. Key Strengths of this portfolio (2-3 bullet points)
3. Key Risk Factors (2-3 bullet points)
4. Specific Recommendations to improve risk-adjusted returns (3-4 actionable points)
5. Suggested stocks to add for better diversification (2-3 specific NSE stocks with reason)

Keep it professional, specific to Indian markets, and actionable. Use ₹ symbols. Format with clear sections.`;

      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":"PLACEHOLDER",
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true"
        },
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,messages:[{role:"user",content:prompt}]})
      });
      const data=await resp.json();
      if(data.error) throw new Error(data.error.message||"API error");
      setAiReport(data.content?.[0]?.text||"Unable to generate report.");
    }catch(e){setAiReport(`AI report generation failed: ${e.message||"Please try again."}`);}
    setAiLoading(false);
    saveSnapshot();
  };

  const TABS=[{id:"overview",label:"Overview"},{id:"holdings",label:"Per-Stock Risk"},{id:"sectors",label:"Sector Risk"},{id:"history",label:"Risk History"},{id:"report",label:"AI Report"}];

  const scoreColor=(s)=>s>=75?"#22c55e":s>=50?"#f59e0b":"#ef4444";
  const ScoreBar=({score,height=8})=>(
    <div style={{height,background:"var(--brd)",borderRadius:height,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${score}%`,background:`linear-gradient(90deg,#ef4444,#f59e0b 50%,#22c55e)`,backgroundSize:"200% 100%",backgroundPositionX:`${100-score}%`,borderRadius:height,transition:"width 0.9s ease"}}/>
    </div>
  );

  return (
    <div className="ani">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>🛡 Risk Analysis</h1>
          <p style={{color:"var(--t2)",fontSize:14,marginTop:4}}>Deep dive into your portfolio's risk profile and exposure</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button className="btn-o" onClick={saveSnapshot} style={{fontSize:13}}>📸 Save Snapshot</button>
          <button className="btn-p" onClick={generateReport} disabled={aiLoading||!n}
            style={{display:"flex",alignItems:"center",gap:8,fontSize:13,opacity:!n?0.5:1}}>
            {aiLoading?<><Spinner size={14}/>Analyzing...</>:"🤖 AI Full Report"}
          </button>
        </div>
      </div>

      {/* Overall risk hero card */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:22}}>
        {/* Big risk score */}
        <Card style={{background:`linear-gradient(135deg,${RC(risk.level)}18,${RC(risk.level)}06)`,border:`1px solid ${RC(risk.level)}35`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"var(--t3)",marginBottom:10}}>Overall Risk Score</div>
              <div style={{fontSize:72,fontWeight:900,lineHeight:1,color:RC(risk.level),letterSpacing:"-3px"}}>{risk.score}</div>
              <div style={{fontSize:14,fontWeight:700,color:RC(risk.level),marginTop:6}}>{risk.level} Risk</div>
              <div style={{fontSize:12,color:"var(--t3)",marginTop:4}}>{n} holdings · {sectorCount} sectors</div>
            </div>
            <div style={{width:120,height:120,position:"relative"}}>
              {/* SVG semicircle gauge */}
              <svg viewBox="0 0 120 80" style={{width:120,height:80}}>
                <path d="M10,70 A50,50,0,0,1,110,70" fill="none" stroke="var(--brd)" strokeWidth="10" strokeLinecap="round"/>
                <path d="M10,70 A50,50,0,0,1,110,70" fill="none" stroke={RC(risk.level)} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${(risk.score/100)*157} 157`} style={{transition:"stroke-dasharray 1s ease"}}/>
                <text x="60" y="68" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--t3)">0 — 100</text>
              </svg>
            </div>
          </div>
          <div style={{marginTop:16}}>
            <ScoreBar score={risk.score} height={10}/>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--t3)",marginTop:5}}>
              <span>🟢 Low (0–39)</span><span>🟡 Medium (40–69)</span><span>🔴 High (70–100)</span>
            </div>
          </div>
        </Card>

        {/* Sub-scores grid */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {subScores.map(s=>(
            <div key={s.label} style={{background:"var(--card2)",border:"1px solid var(--brd)",borderRadius:12,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{fontSize:18}}>{s.icon}</span>
                <span style={{fontWeight:800,fontSize:18,color:scoreColor(s.score)}}>{s.score}</span>
              </div>
              <div style={{fontSize:12,fontWeight:700,color:"var(--t1)",marginBottom:4}}>{s.label}</div>
              <ScoreBar score={s.score} height={5}/>
              <div style={{fontSize:11,color:"var(--t3)",marginTop:5}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,background:"var(--card)",border:"1px solid var(--brd)",borderRadius:12,padding:5,width:"fit-content"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:"8px 18px",borderRadius:8,border:"none",fontSize:13,fontWeight:activeTab===t.id?700:500,cursor:"pointer",fontFamily:"inherit",
              background:activeTab===t.id?"var(--acc)":"transparent",color:activeTab===t.id?"#fff":"var(--t2)",transition:"all 0.18s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab==="overview"&&(
        <div className="ani">
          {/* Insights */}
          <Card style={{marginBottom:18}}>
            <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>🧠 Smart Insights & Recommendations</div>
            {risk.insights.length===0&&!n?(
              <div style={{color:"var(--t3)",fontSize:13,padding:"12px 0"}}>Add stocks to your portfolio to see risk insights.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {risk.insights.map((ins,i)=>{
                  const c={warning:"#f59e0b",danger:"#ef4444",info:"#6366f1",success:"#22c55e"}[ins.type]||"#6366f1";
                  const ic={warning:"⚠️",danger:"🔴",info:"💡",success:"✅"}[ins.type];
                  return (
                    <div key={i} style={{display:"flex",gap:12,padding:"13px 16px",borderRadius:12,background:`${c}10`,border:`1px solid ${c}25`}}>
                      <span style={{fontSize:18,flexShrink:0}}>{ic}</span>
                      <div>
                        <div style={{color:c,fontWeight:600,fontSize:13,marginBottom:2}}>{ins.msg}</div>
                        <div style={{color:"var(--t3)",fontSize:11}}>{
                          ins.type==="warning"?"Consider rebalancing to reduce this exposure":
                          ins.type==="danger"?"Action recommended to protect your capital":
                          ins.type==="success"?"Keep maintaining this balance":
                          "Opportunity to improve portfolio quality"
                        }</div>
                      </div>
                    </div>
                  );
                })}
                {/* extra insight tips */}
                {n>=3&&<div style={{display:"flex",gap:12,padding:"13px 16px",borderRadius:12,background:"#6366f110",border:"1px solid #6366f125"}}>
                  <span style={{fontSize:18}}>📌</span>
                  <div style={{color:"#6366f1",fontWeight:600,fontSize:13}}>
                    Use the Simulate page to test how adding a new stock changes your risk score before committing capital.
                  </div>
                </div>}
              </div>
            )}
          </Card>

          {/* Risk factor cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:18}}>
            {[
              {title:"Diversification Risk",val:diversScore,inv:true,
               desc:n<3?"Critical: Fewer than 3 stocks — extremely concentrated":n<5?"Moderate: Add 2–3 more stocks":"Good: Portfolio well spread across stocks",
               action:n<5?"Add more stocks across different sectors":"Maintain current number of holdings"},
              {title:"Sector Concentration Risk",val:concentScore,inv:true,
               desc:maxSectorPct>60?"Critical: One sector > 60% of portfolio":maxSectorPct>40?"High: One sector dominates portfolio":"Healthy: No single sector dominates",
               action:maxSectorPct>40?"Reduce exposure to top sector by adding others":"Continue diversifying across sectors"},
              {title:"Volatility Risk",val:clamp(100-risk.score,0,100),inv:false,
               desc:risk.score>=70?"High volatility expected in this portfolio":risk.score>=40?"Moderate volatility, manageable":"Low volatility portfolio, relatively stable",
               action:risk.score>=70?"Consider adding defensive stocks (Pharma, FMCG, Utilities)":"Portfolio shows reasonable stability"},
            ].map(card=>(
              <Card key={card.title}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>{card.title}</div>
                <div style={{fontSize:28,fontWeight:900,color:scoreColor(card.val),marginBottom:8}}>{card.val}<span style={{fontSize:14,fontWeight:400,color:"var(--t3)"}}>/100</span></div>
                <ScoreBar score={card.val}/>
                <div style={{fontSize:12,color:"var(--t2)",marginTop:10,lineHeight:1.5}}>{card.desc}</div>
                <div style={{fontSize:11,color:"var(--t3)",marginTop:8,padding:"8px 10px",background:"var(--card2)",borderRadius:8,lineHeight:1.5}}>
                  💡 {card.action}
                </div>
              </Card>
            ))}
          </div>

          {/* Suggested additions */}
          <Card>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📋 Suggested Additions for Better Risk Balance</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              {[
                {sym:"SUNPHARMA.NS",reason:"Pharma is defensive — protects during market downturns",color:"#06b6d4"},
                {sym:"HINDUNILVR.NS",reason:"FMCG gives stable earnings regardless of market cycle",color:"#10b981"},
                {sym:"POWERGRID.NS",reason:"Utilities provide stable dividend income and low beta",color:"#84cc16"},
                {sym:"TCS.NS",reason:"Large-cap IT gives growth exposure with relative stability",color:"#6366f1"},
                {sym:"HDFCBANK.NS",reason:"Quality banking adds financial sector exposure safely",color:"#3b82f6"},
                {sym:"MARUTI.NS",reason:"Auto sector provides cyclical growth opportunities",color:"#f97316"},
              ].filter(s=>!portfolio[s.sym]).slice(0,3).map(s=>(
                <div key={s.sym} style={{background:"var(--card2)",border:`1px solid ${s.color}30`,borderRadius:12,padding:"14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontWeight:800,fontSize:13}}>{s.sym}</span>
                    <Badge color={s.color}>{STOCKS[s.sym]?.sector}</Badge>
                  </div>
                  <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.5,marginBottom:8}}>{s.reason}</div>
                  <div style={{fontSize:13,fontWeight:700}}>{fmtC(livePrice(s.sym)||STOCKS[s.sym]?.base)}</div>
                </div>
              ))}
              {Object.keys(portfolio).filter(s=>["SUNPHARMA.NS","HINDUNILVR.NS","POWERGRID.NS","TCS.NS","HDFCBANK.NS","MARUTI.NS"].includes(s)).length>=3&&(
                <div style={{gridColumn:"1/-1",textAlign:"center",color:"var(--t2)",fontSize:13,padding:"16px 0"}}>
                  ✅ You already hold most recommended defensive stocks — great job!
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: PER-STOCK RISK ── */}
      {activeTab==="holdings"&&(
        <div className="ani">
          {holdingRisk.length===0?(
            <Card style={{textAlign:"center",padding:48}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontWeight:700,fontSize:17}}>No holdings to analyse</div>
              <div style={{color:"var(--t2)",fontSize:13,marginTop:8}}>Add stocks via the Trade page first.</div>
            </Card>
          ):(
            <Card pad={0} style={{overflow:"hidden"}}>
              <div style={{padding:"14px 20px",borderBottom:"1px solid var(--brd)",fontWeight:700,fontSize:15}}>Per-Stock Risk Breakdown</div>
              <table>
                <thead><tr>
                  <th>Stock</th><th>Sector</th><th>Weight</th><th>P&L</th><th>P/E Ratio</th>
                  <th>Risk Score</th><th>Risk Level</th><th>Risk Bar</th>
                </tr></thead>
                <tbody>
                  {holdingRisk.map(h=>(
                    <tr key={h.sym}>
                      <td>
                        <div style={{fontWeight:700}}>{h.sym}</div>
                        <div style={{fontSize:11,color:"var(--t3)"}}>{h.name}</div>
                      </td>
                      <td><Badge color={SECTOR_COLORS[h.sector]||"#6366f1"}>{h.sector}</Badge></td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:50,height:5,background:"var(--brd)",borderRadius:3,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${h.weight}%`,background:"var(--acc)",borderRadius:3}}/>
                          </div>
                          <span style={{fontWeight:700,fontSize:13}}>{fmt(h.weight,1)}%</span>
                        </div>
                      </td>
                      <td style={{color:h.pnlPct>=0?"#22c55e":"#ef4444",fontWeight:700}}>{fmtP(h.pnlPct)}</td>
                      <td style={{color:"var(--t2)"}}>{h.pe}x</td>
                      <td style={{fontWeight:800,fontSize:16,color:RC(h.riskLevel)}}>{h.riskScore}</td>
                      <td>
                        <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                          background:`${RC(h.riskLevel)}20`,color:RC(h.riskLevel)}}>
                          {h.riskLevel}
                        </span>
                      </td>
                      <td style={{width:100}}>
                        <div style={{width:"100%",height:6,background:"var(--brd)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${h.riskScore}%`,background:RC(h.riskLevel),borderRadius:3,transition:"width 0.8s"}}/>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{padding:"12px 20px",borderTop:"1px solid var(--brd)",display:"flex",gap:20,fontSize:12,color:"var(--t3)"}}>
                <span>Risk is calculated from: position weight, sector type (defensive vs cyclical/volatile), and stock volatility profile.</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: SECTOR RISK ── */}
      {activeTab==="sectors"&&(
        <div className="ani">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
            {/* Donut + legend */}
            <Card>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Sector Distribution</div>
              {Object.keys(risk.sectors).length>0?(
                <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
                  <DonutChart sectors={risk.sectors} size={160}/>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
                    {Object.entries(risk.sectors).sort((a,b)=>b[1]-a[1]).map(([s,p])=>(
                      <div key={s}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <div style={{width:9,height:9,borderRadius:2,background:SECTOR_COLORS[s]||"#6366f1",flexShrink:0}}/>
                            <span style={{fontSize:12,color:"var(--t2)"}}>{s}</span>
                          </div>
                          <span style={{fontSize:12,fontWeight:700,color:p>40?"#ef4444":p>25?"#f59e0b":"#22c55e"}}>{fmt(p,1)}%</span>
                        </div>
                        <div style={{height:5,background:"var(--brd)",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${p}%`,background:SECTOR_COLORS[s]||"#6366f1",borderRadius:3}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ):<div style={{color:"var(--t3)",fontSize:13,padding:"24px 0",textAlign:"center"}}>No holdings to show</div>}
            </Card>

            {/* Sector risk table */}
            <Card>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Sector Risk Assessment</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {sector:"Banking",type:"Cyclical",risk:"Medium",desc:"Sensitive to interest rates & NPA cycles"},
                  {sector:"IT",type:"Defensive",risk:"Low-Med",desc:"Stable earnings, USD revenue hedge"},
                  {sector:"Pharma",type:"Defensive",risk:"Low",desc:"Counter-cyclical, essential products"},
                  {sector:"FMCG",type:"Defensive",risk:"Low",desc:"Stable demand, pricing power"},
                  {sector:"Energy",type:"Cyclical",risk:"Medium",desc:"Commodity price dependent"},
                  {sector:"Auto",type:"Cyclical",risk:"Medium-High",desc:"Rate sensitive, cyclical demand"},
                  {sector:"NBFC",type:"Cyclical",risk:"High",desc:"High leverage, credit risk exposure"},
                  {sector:"Infrastructure",type:"Growth",risk:"Medium",desc:"Policy driven, long gestation"},
                  {sector:"Utilities",type:"Defensive",risk:"Low",desc:"Regulated returns, high dividend yield"},
                  {sector:"Metals",type:"Cyclical",risk:"High",desc:"Global commodity price dependent"},
                ].filter(s=>risk.sectors[s.sector]).map(s=>(
                  <div key={s.sector} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,background:"var(--card2)",border:"1px solid var(--brd)"}}>
                    <div style={{width:10,height:10,borderRadius:2,background:SECTOR_COLORS[s.sector]||"#6366f1",flexShrink:0}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700}}>{s.sector} <span style={{fontSize:11,color:"var(--t3)",fontWeight:400}}>· {s.type}</span></div>
                      <div style={{fontSize:11,color:"var(--t3)"}}>{s.desc}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:12,fontWeight:700,color:s.risk.includes("High")?"#ef4444":s.risk.includes("Low")?"#22c55e":"#f59e0b"}}>{s.risk}</div>
                      <div style={{fontSize:11,color:"var(--t3)"}}>{fmt(risk.sectors[s.sector],1)}% of portfolio</div>
                    </div>
                  </div>
                ))}
                {!Object.keys(risk.sectors).length&&<div style={{color:"var(--t3)",fontSize:13,textAlign:"center",padding:"20px 0"}}>No holdings to analyse</div>}
              </div>
            </Card>
          </div>

          {/* Ideal vs actual allocation */}
          <Card>
            <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Ideal vs Actual Allocation</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
              {[
                {sector:"Banking", ideal:20,color:"#3b82f6"},
                {sector:"IT",      ideal:20,color:"#6366f1"},
                {sector:"Pharma",  ideal:15,color:"#06b6d4"},
                {sector:"FMCG",    ideal:10,color:"#10b981"},
                {sector:"Energy",  ideal:10,color:"#f59e0b"},
                {sector:"Auto",    ideal:8, color:"#f97316"},
                {sector:"NBFC",    ideal:7, color:"#8b5cf6"},
                {sector:"Infra",   ideal:5, color:"#64748b"},
                {sector:"Others",  ideal:5, color:"#94a3b8"},
              ].slice(0,5).map(item=>{
                const actual=risk.sectors[item.sector]||0;
                const diff=actual-item.ideal;
                return (
                  <div key={item.sector} style={{background:"var(--card2)",borderRadius:12,padding:"14px"}}>
                    <div style={{fontSize:12,fontWeight:700,marginBottom:10,color:"var(--t1)"}}>{item.sector}</div>
                    <div style={{marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)",marginBottom:3}}>
                        <span>Ideal</span><span>{item.ideal}%</span>
                      </div>
                      <div style={{height:5,background:"var(--brd)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${item.ideal}%`,background:`${item.color}80`,borderRadius:3}}/>
                      </div>
                    </div>
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--t3)",marginBottom:3}}>
                        <span>Actual</span><span style={{color:Math.abs(diff)>15?"#ef4444":Math.abs(diff)>8?"#f59e0b":"#22c55e"}}>{fmt(actual,1)}%</span>
                      </div>
                      <div style={{height:5,background:"var(--brd)",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(actual,100)}%`,background:item.color,borderRadius:3}}/>
                      </div>
                    </div>
                    <div style={{marginTop:8,fontSize:11,fontWeight:700,color:Math.abs(diff)>15?"#ef4444":Math.abs(diff)>8?"#f59e0b":"#22c55e"}}>
                      {diff===0?"On target":diff>0?`+${fmt(diff,1)}% overweight`:`${fmt(diff,1)}% underweight`}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: RISK HISTORY ── */}
      {activeTab==="history"&&(
        <div className="ani">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
            <Card>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Risk Score Over Time</div>
              {snapshots.length>=2?(
                <MiniLineChart data={snapshots.map(s=>s.score)} height={140}/>
              ):(
                <div style={{height:140,display:"flex",alignItems:"center",justifyContent:"center",color:"var(--t3)",fontSize:13}}>
                  Save snapshots over time to see risk trend
                </div>
              )}
            </Card>
            <Card>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Snapshot History</div>
              {snapshots.length===0?(
                <div style={{color:"var(--t3)",fontSize:13,padding:"24px 0",textAlign:"center"}}>
                  No snapshots saved yet.<br/>Click "Save Snapshot" to record current risk.
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:260,overflowY:"auto"}}>
                  {snapshots.slice(0,10).map((s,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"var(--card2)",borderRadius:10,border:"1px solid var(--brd)"}}>
                      <div>
                        <div style={{fontSize:12,color:"var(--t3)"}}>{new Date(s.date).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                        <div style={{fontSize:11,color:"var(--t3)",marginTop:2}}>{s.holdings} holdings · {Object.keys(s.sectors||{}).length} sectors</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontWeight:800,fontSize:20,color:RC(s.level)}}>{s.score}</div>
                        <div style={{fontSize:11,color:RC(s.level),fontWeight:600}}>{s.level}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          {snapshots.length>0&&(
            <Card>
              <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>Risk Trend Analysis</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
                {[
                  {label:"Current Score",  val:`${risk.score}/100`,    color:RC(risk.level)},
                  {label:"Best Score",     val:`${Math.min(...snapshots.map(s=>s.score))}/100`, color:"#22c55e"},
                  {label:"Worst Score",    val:`${Math.max(...snapshots.map(s=>s.score))}/100`, color:"#ef4444"},
                  {label:"Avg Score",      val:`${fmt(snapshots.reduce((a,s)=>a+s.score,0)/snapshots.length,0)}/100`, color:"#f59e0b"},
                ].map(m=>(
                  <div key={m.label} style={{background:"var(--card2)",borderRadius:12,padding:"14px"}}>
                    <div style={{fontSize:11,color:"var(--t3)",marginBottom:6}}>{m.label}</div>
                    <div style={{fontSize:22,fontWeight:800,color:m.color}}>{m.val}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: AI REPORT ── */}
      {activeTab==="report"&&(
        <div className="ani">
          <Card>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontWeight:700,fontSize:15}}>🤖 AI Risk Analysis Report</div>
              <button className="btn-p" onClick={generateReport} disabled={aiLoading||!n}
                style={{display:"flex",alignItems:"center",gap:8,fontSize:13,opacity:!n?0.5:1}}>
                {aiLoading?<><Spinner size={14}/>Generating...</>:"Generate Report"}
              </button>
            </div>
            {aiLoading&&(
              <div style={{padding:"32px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:16,color:"var(--t2)"}}>
                <Spinner size={32} color="var(--acc)"/>
                <div style={{fontSize:14}}>Analysing your portfolio with AI...</div>
                <div style={{fontSize:12,color:"var(--t3)"}}>This may take a few seconds</div>
              </div>
            )}
            {!aiLoading&&!aiReport&&!n&&(
              <div style={{padding:"32px 0",textAlign:"center",color:"var(--t3)",fontSize:13}}>
                <div style={{fontSize:40,marginBottom:12}}>📊</div>
                Add stocks to your portfolio first, then generate an AI report.
              </div>
            )}
            {!aiLoading&&!aiReport&&n>0&&(
              <div style={{padding:"32px 0",textAlign:"center",color:"var(--t3)",fontSize:13}}>
                <div style={{fontSize:40,marginBottom:12}}>🤖</div>
                <div style={{marginBottom:8}}>Click "Generate Report" for a comprehensive AI risk analysis</div>
                <div style={{fontSize:12}}>Includes strengths, risk factors, recommendations & suggested stocks</div>
              </div>
            )}
            {!aiLoading&&aiReport&&(
              <div style={{background:"var(--card2)",borderRadius:12,padding:"20px 24px",border:"1px solid var(--brd)"}}>
                <pre style={{fontFamily:"'DM Sans',system-ui,sans-serif",fontSize:14,lineHeight:1.8,color:"var(--t1)",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
                  {aiReport}
                </pre>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DATABASE MANAGER PAGE
   ════════════════════════════════════════════════════════════════ */
function DatabasePage({user,toast}){
  const [activeTable,setActiveTable]=useState("portfolio");
  const [data,setData]=useState({});
  const [stats,setStats]=useState({});
  const [confirmClear,setConfirmClear]=useState(null);
  const [search,setSearch]=useState("");

  const refresh=useCallback(async()=>{
    try{
      const [portData,txnsData,histData,watchData,simData,riskData] = await Promise.all([
        apiFetch("/portfolio"),
        apiFetch("/transactions?limit=500"),
        apiFetch("/history"),
        apiFetch("/watchlist"),
        apiFetch("/simulations"),
        apiFetch("/risk"),
      ]);
      const portfolioRows=(portData?.holdings||[]).map(h=>({symbol:h.symbol,quantity:h.qty,avg_price:h.avg_price,current_price:livePrice(h.symbol)||h.avg_price,sector:STOCKS[h.symbol]?.sector||"Other"}));
      const watchlistRows=(watchData||[]).map((w,i)=>{const sym=w.symbol||w;return{id:i,symbol:sym,name:STOCKS[sym]?.name||sym,sector:STOCKS[sym]?.sector||"Other",price:livePrice(sym)};});
      const txnRows=(txnsData||[]).map(t=>({...t,date:t.created_at||t.date}));
      const histRows=(histData||[]).map(h=>({date:h.date,value:h.value}));
      const simRows=(simData||[]).map(s=>({...s,date:s.created_at||s.date,beforeScore:s.before_score,afterScore:s.after_score}));
      const riskRows=(riskData||[]).map(r=>({...r,date:r.created_at||r.date}));
      setStats({
        portfolio:{count:portfolioRows.length,label:"Holdings",icon:"📊"},
        txns:{count:txnRows.length,label:"Transactions",icon:"💸"},
        history:{count:histRows.length,label:"History Entries",icon:"📈"},
        watchlist:{count:watchlistRows.length,label:"Watchlist",icon:"⭐"},
        simulations:{count:simRows.length,label:"Simulations",icon:"🔮"},
        risk:{count:riskRows.length,label:"Risk Snapshots",icon:"⚠️"},
      });
      setData({portfolio:portfolioRows,txns:txnRows,history:histRows,watchlist:watchlistRows,simulations:simRows,risk:riskRows});
    }catch(e){ console.error("DB refresh error:",e.message); }
  },[user.username]);

  useEffect(()=>{ refresh(); const iv=setInterval(refresh,5000); return()=>clearInterval(iv); },[refresh]);

  const TABLE_META={
    portfolio:{label:"Portfolio",icon:"📊",cols:["symbol","quantity","avg_price","current_price","sector"]},
    txns:{label:"Transactions",icon:"💸",cols:["date","type","symbol","qty","price"]},
    history:{label:"Price History",icon:"📈",cols:["date","value"]},
    watchlist:{label:"Watchlist",icon:"⭐",cols:["symbol","name","sector","price"]},
    simulations:{label:"Simulations",icon:"🔮",cols:["date","symbol","amount","qty","price","beforeScore","afterScore"]},
    // users table removed — not accessible via regular user token
    risk:{label:"Risk Snapshots",icon:"⚠️",cols:["date","score","level"]},
  };

  const rows=(data[activeTable]||[]).filter(r=>{
    if(!search) return true;
    return JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
  });

  const exportJSON=()=>{
    const blob=new Blob([JSON.stringify(data[activeTable],null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`stockiq_${activeTable}.json`; a.click();
    toast(`Exported ${activeTable} as JSON`,"success");
  };
  const exportCSV=()=>{
    const cols=TABLE_META[activeTable].cols;
    const rows_data=[cols.join(","),...(data[activeTable]||[]).map(r=>cols.map(c=>`"${r[c]??""}`).join(","))];
    const blob=new Blob([rows_data.join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`stockiq_${activeTable}.csv`; a.click();
    toast(`Exported ${activeTable} as CSV`,"success");
  };
  const clearTable=async()=>{
    toast("Clearing is managed via the backend. Use DELETE /users/me to remove all data.","info");
    setConfirmClear(null);
  };

  const exportAll=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="stockiq_full_backup.json"; a.click();
    toast("Full database exported","success");
  };
  const importData=(e)=>{
    toast("Import not available — data is managed by the FastAPI backend.","info");
  };

  const fmtCell=(key,val)=>{
    if(val==null) return <span style={{color:"var(--t3)"}}>—</span>;
    if(key==="type") return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:12,fontSize:11,fontWeight:700,background:val==="buy"?"#22c55e20":"#ef444420",color:val==="buy"?"#22c55e":"#ef4444"}}>{val.toUpperCase()}</span>;
    if(key==="avg_price"||key==="current_price"||key==="price"||key==="value"||key==="amount") return <span style={{fontWeight:600}}>{fmtC(val)}</span>;
    if(key==="date") return <span style={{color:"var(--t3)",fontSize:12}}>{String(val).slice(0,16).replace("T"," ")}</span>;
    if(key==="level"||key==="sector") return <Badge color={key==="level"?RC(val):(SECTOR_COLORS[val]||"#6366f1")}>{val}</Badge>;
    if(key==="score") return <span style={{fontWeight:700,color:RC(val>=70?"High":val>=40?"Medium":"Low")}}>{val}/100</span>;
    if(key==="symbol") return <span style={{fontWeight:700}}>{val}</span>;
    return <span>{String(val)}</span>;
  };

  return (
    <div className="ani">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>🗄 Database Manager</h1>
          <p style={{color:"var(--t2)",fontSize:14,marginTop:4}}>Browse, export, and manage all your stored data</p>
        </div>
        <div style={{display:"flex",gap:10}}>
          <label style={{padding:"9px 16px",borderRadius:10,border:"1px solid var(--brd)",color:"var(--t2)",fontSize:13,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            ⬆ Import <input type="file" accept=".json" onChange={importData} style={{display:"none"}}/>
          </label>
          <button className="btn-p" onClick={exportAll} style={{display:"flex",alignItems:"center",gap:6,fontSize:13}}>⬇ Export All</button>
        </div>
      </div>

      {/* DB Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10,marginBottom:22}}>
        {Object.entries(stats).map(([k,v])=>(
          <div key={k} onClick={()=>setActiveTable(k==="portfolio"?"portfolio":k==="txns"?"txns":k==="history"?"history":k==="watchlist"?"watchlist":k==="simulations"?"simulations":"risk")}
            style={{background:activeTable===k?"var(--acc)":"var(--card2)",border:`1px solid ${activeTable===k?"var(--acc)":"var(--brd)"}`,borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all 0.18s"}}>
            <div style={{fontSize:18,marginBottom:6}}>{v.icon}</div>
            <div style={{fontSize:20,fontWeight:800,color:activeTable===k?"#fff":"var(--t1)"}}>{v.count}</div>
            <div style={{fontSize:11,color:activeTable===k?"rgba(255,255,255,0.75)":"var(--t3)",marginTop:2}}>{v.label}</div>
          </div>
        ))}
      </div>

      {/* Table viewer */}
      <Card pad={0} style={{overflow:"hidden"}}>
        {/* Table header toolbar */}
        <div style={{padding:"14px 18px",borderBottom:"1px solid var(--brd)",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontWeight:700,fontSize:15}}>{TABLE_META[activeTable]?.icon} {TABLE_META[activeTable]?.label}</span>
            <span style={{background:"var(--card2)",border:"1px solid var(--brd)",borderRadius:20,padding:"2px 10px",fontSize:12,color:"var(--t2)",fontWeight:600}}>{rows.length} rows</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Filter rows..." style={{padding:"6px 12px",fontSize:12,borderRadius:20,width:180}}/>
            <button className="btn-o" onClick={exportJSON} style={{fontSize:12,padding:"6px 14px"}}>JSON</button>
            <button className="btn-o" onClick={exportCSV} style={{fontSize:12,padding:"6px 14px"}}>CSV</button>
            {activeTable!=="users"&&(
              confirmClear===activeTable?(
                <div style={{display:"flex",gap:6}}>
                  <button onClick={clearTable} style={{padding:"6px 12px",borderRadius:8,background:"#ef4444",color:"#fff",border:"none",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Confirm</button>
                  <button onClick={()=>setConfirmClear(null)} className="btn-o" style={{fontSize:12,padding:"6px 12px"}}>Cancel</button>
                </div>
              ):(
                <button onClick={()=>setConfirmClear(activeTable)} style={{padding:"6px 12px",borderRadius:8,background:"transparent",border:"1px solid #ef444460",color:"#ef4444",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>🗑 Clear</button>
              )
            )}
          </div>
        </div>

        {/* Table body */}
        <div style={{overflowX:"auto",maxHeight:500,overflowY:"auto"}}>
          <table>
            <thead style={{position:"sticky",top:0,background:"var(--card)",zIndex:10}}>
              <tr>{TABLE_META[activeTable]?.cols.map(c=><th key={c}>{c.replace(/_/g," ")}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length===0?(
                <tr><td colSpan={10} style={{textAlign:"center",color:"var(--t3)",padding:40}}>No data in this table.</td></tr>
              ):rows.map((row,i)=>(
                <tr key={i}>
                  {TABLE_META[activeTable]?.cols.map(c=><td key={c}>{fmtCell(c,row[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Schema reference */}
      <Card style={{marginTop:22}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📐 Database Schema</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[
            {table:"users",cols:["username TEXT (PK)","email TEXT","password_hash TEXT","created_at TEXT"]},
            {table:"portfolio",cols:["user_id (FK)","symbol TEXT","quantity INT","avg_price REAL","updated_at TEXT"]},
            {table:"transactions",cols:["id TEXT (PK)","symbol TEXT","type TEXT","qty INT","price REAL","date TEXT"]},
            {table:"portfolio_history",cols:["date TEXT","value REAL"]},
            {table:"watchlist",cols:["symbol TEXT"]},
            {table:"simulations",cols:["id TEXT (PK)","symbol TEXT","amount REAL","qty INT","price REAL","beforeScore INT","afterScore INT","date TEXT"]},
          ].map(({table,cols})=>(
            <div key={table} style={{background:"var(--card2)",border:"1px solid var(--brd)",borderRadius:10,padding:14}}>
              <div style={{fontWeight:700,fontSize:12,color:"var(--acc)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>{table}</div>
              {cols.map(c=><div key={c} style={{fontSize:11,color:"var(--t3)",padding:"2px 0",borderBottom:"1px solid var(--brd)",fontFamily:"monospace"}}>{c}</div>)}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ════════════════════════════════════════════════════════════════ */
function SettingsPage({user,theme,setTheme,toast,onLogout}){
  const [profile,setProfile]=useState({username:user.username,email:user.email||""});
  const [pwd,setPwd]=useState({current:"",new1:"",new2:""});
  const [confirmDel,setConfirmDel]=useState(false);
  const [stats,setStats]=useState({portfolio:{count:0,label:'Holdings',icon:'📊'},txns:{count:0,label:'Transactions',icon:'💸'},history:{count:0,label:'History Entries',icon:'📈'},watchlist:{count:0,label:'Watchlist',icon:'⭐'},simulations:{count:0,label:'Simulations',icon:'🔮'},risk:{count:0,label:'Risk Snapshots',icon:'⚠️'}});
  useEffect(()=>{
    Promise.all([apiFetch('/portfolio'),apiFetch('/transactions?limit=500'),apiFetch('/history'),apiFetch('/watchlist'),apiFetch('/simulations'),apiFetch('/risk')]).then(([p,t,h,w,s,r])=>{
      setStats({portfolio:{count:(p?.holdings||[]).length,label:'Holdings',icon:'📊'},txns:{count:(t||[]).length,label:'Transactions',icon:'💸'},history:{count:(h||[]).length,label:'History Entries',icon:'📈'},watchlist:{count:(w||[]).length,label:'Watchlist',icon:'⭐'},simulations:{count:(s||[]).length,label:'Simulations',icon:'🔮'},risk:{count:(r||[]).length,label:'Risk Snapshots',icon:'⚠️'}});
    }).catch(()=>{});
  },[]);

  const saveProfile=async()=>{
    try{
      await apiFetch("/users/me/email",{method:"PUT",body:JSON.stringify({email:profile.email})});
      toast("Profile updated","success");
    }catch(e){ toast("Update failed: "+e.message,"error"); }
  };
  const changePwd=async()=>{
    if(pwd.new1.length<4){toast("New password must be 4+ chars","error");return;}
    if(pwd.new1!==pwd.new2){toast("Passwords don't match","error");return;}
    toast("Password change requires re-registration via the backend API.","info");
    setPwd({current:"",new1:"",new2:""});
  };
  const deleteData=async()=>{
    try{
      await apiFetch("/users/me",{method:"DELETE"});
      setConfirmDel(false);
      clearToken();
      onLogout();
      toast("Account and all data deleted","info");
    }catch(e){ toast("Delete failed: "+e.message,"error"); }
  };

  const storageSize="(via FastAPI backend)";

  return (
    <div className="ani" style={{maxWidth:680}}>
      <h1 style={{fontSize:24,fontWeight:800,marginBottom:22,letterSpacing:"-0.5px"}}>⚙ Settings</h1>

      {/* Profile */}
      <Card style={{marginBottom:18}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>👤 Profile</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div>
            <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:600}}>Username</label>
            <input value={profile.username} disabled style={{opacity:0.6,cursor:"not-allowed"}}/>
          </div>
          <div>
            <label style={{fontSize:12,color:"var(--t2)",display:"block",marginBottom:6,fontWeight:600}}>Email</label>
            <input value={profile.email} onChange={e=>setProfile(p=>({...p,email:e.target.value}))} placeholder="your@email.com"/>
          </div>
        </div>
        <button className="btn-p" style={{marginTop:14}} onClick={saveProfile}>Save Profile</button>
      </Card>

      {/* Change password */}
      <Card style={{marginBottom:18}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>🔒 Change Password</div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input type="password" value={pwd.current} onChange={e=>setPwd(p=>({...p,current:e.target.value}))} placeholder="Current password"/>
          <input type="password" value={pwd.new1}    onChange={e=>setPwd(p=>({...p,new1:e.target.value}))}    placeholder="New password (min 4 chars)"/>
          <input type="password" value={pwd.new2}    onChange={e=>setPwd(p=>({...p,new2:e.target.value}))}    placeholder="Confirm new password"/>
          <button className="btn-p" style={{alignSelf:"flex-start"}} onClick={changePwd}>Update Password</button>
        </div>
      </Card>

      {/* Appearance */}
      <Card style={{marginBottom:18}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>🎨 Appearance</div>
        <div style={{display:"flex",gap:12}}>
          {["dark","light"].map(t=>(
            <button key={t} onClick={()=>setTheme(t)}
              style={{flex:1,padding:"14px",borderRadius:12,border:`2px solid ${theme===t?"var(--acc)":"var(--brd)"}`,
                background:theme===t?"var(--acc)20":"transparent",fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"inherit",
                color:theme===t?"var(--acc)":"var(--t2)"}}>
              {t==="dark"?"🌙 Dark Mode":"☀️ Light Mode"}
              {theme===t&&<span style={{display:"block",fontSize:11,fontWeight:400,marginTop:4,color:"var(--t2)"}}>Active</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Storage stats */}
      <Card style={{marginBottom:18}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:14}}>📦 Storage</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
          {Object.entries(stats).slice(1).map(([k,v])=>(
            <div key={k} style={{background:"var(--card2)",borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontSize:16,marginBottom:4}}>{v.icon}</div>
              <div style={{fontWeight:700,fontSize:18}}>{v.count}</div>
              <div style={{fontSize:10,color:"var(--t3)"}}>{v.label}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:"var(--card2)",borderRadius:10}}>
          <span style={{fontSize:13,color:"var(--t2)"}}>Local storage used</span>
          <span style={{fontWeight:700,fontSize:14}}>{storageSize}</span>
        </div>
      </Card>

      {/* Danger zone */}
      <Card style={{border:"1px solid #ef444440"}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:14,color:"#ef4444"}}>⚠️ Danger Zone</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {confirmDel?(
            <div style={{padding:"12px 16px",background:"#ef444415",borderRadius:10,border:"1px solid #ef444430",fontSize:13}}>
              <p style={{marginBottom:10,color:"var(--t1)"}}>This will permanently delete all your portfolio, transactions, and history. Are you sure?</p>
              <div style={{display:"flex",gap:8}}>
                <button onClick={deleteData} className="btn-d" style={{fontSize:13,padding:"8px 16px"}}>Yes, Delete Everything</button>
                <button onClick={()=>setConfirmDel(false)} className="btn-o" style={{fontSize:13,padding:"8px 16px"}}>Cancel</button>
              </div>
            </div>
          ):(
            <>
              <button onClick={()=>setConfirmDel(true)} style={{padding:"9px 18px",borderRadius:10,border:"1px solid #ef444450",background:"transparent",color:"#ef4444",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                🗑 Clear All My Data
              </button>
              <button onClick={onLogout} style={{padding:"9px 18px",borderRadius:10,border:"1px solid var(--brd)",background:"transparent",color:"var(--t2)",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                ⊗ Sign Out
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}