# Evidence matrix — SS-INT-001

Actual representative checks, not a correctness proof. Historical A scaffolding tests still use doubles where named; engine/public-facade and new real integration tests now execute B's implementation. No engine TODO or filtered test remains.

| Area | Actual evidence / limitation |
|---|---|
| Joint absences and chronology | Public engine tests PASS; exact79/102 and40/52 first failures |
| Recovery and unrelated registers | Public tests PASS; A same-day37/48 ->38/49 ->39/50 regression exposed/fixed a date-vs-session bug |
| R/T/B, requirement versus margin | Real engine tests PASS |
| 0/0,100%,exact rounded boundary | Real engine and independent fixture checks PASS |
| Registers/atomic weights/safe bounds/invalid refs | Representative public tests PASS |
| Snapshot confirmation/supersession | Real validator boundary fixtures PASS; real P1 controller rejects09:59 then accepts10:00 at last-session end |
| Current-time freshness/gaps | Injected-clock real engine tests and A acceptance-boundary tests PASS; browser actual session-start rollover/old-tab timing UNRUN |
| Linked/independent compulsory events | Real tests PASS; served demo linked event invalidated a commitment without changing103/115 units |
| Holiday/replacement/extra/overlap | Real engine tests PASS; complete browser editing matrix UNRUN |
| Hard range / full-semester validation | Real engine tests PASS |
| Greedy ranking/skip/K/termination | Real engine tests PASS; no optimality claim |
| Cancellation / already-off / outside horizon | Real engine tests PASS; all update combinations in browser UNRUN |
| Atomic subset acceptance | Real controller tests and manual served UI PASS: accepted only one of two suggestions |
| Counts update / commitment invalidation | Served UI PASS:90/100 ->78/100; commitment preserved and marked invalid at78/101 |
| Storage/reload | Served manual setup/commit/snapshot reload PASS, evaluation recomputed; corrupt/quota adapter tests PASS |
| Storage in second profile / live quota failure | UNRUN |
| Demo isolation / explicit replacement | Served UI PASS; personal blocked plan restored after demo event/uncommit/replacement sequence |
| Calendar/date details | Served desktop markers/details PASS; Enter date selection retained focus |
| Mobile/full keyboard/screen reader | Prior C isolated390px harness reported PASS; merged app mobile/full assistive checks UNRUN |
| Independent arithmetic | Python Fraction checker 342/342 PASS; tiny feasibility subsets, not optimality; one session/date in checker |
| Syntax/build/transport |23 JS modules and build PASS; archive manifest checked at packaging |
| D integrated / B correction review | D READY and B ACCEPT received; D added 15 targeted +1,200 generated multi-register checks; no full release approval |
| Deployment/subpaths / classmate usability / submission | UNRUN; official submission details and applicable MAIT data unverified |
