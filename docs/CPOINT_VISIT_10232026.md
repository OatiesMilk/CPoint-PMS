CPOINT (visit last 10/23/2026)

TO BE REMOVED (review and make sure affected areas can also be safely removed)

- Material Requests
- Procurement
- Review Queue
- Repair Station
- Salvage

Interval Check-in \= Batch

- System admin can edit and set a Lunch Break (start and end time) in the system for example, 11:00am \- 12:00pm (automatically pause the check-in if it falls in range of the lunch break)
- every 4 hrs
  - 8:00am \- 1:00pm \= Batch 1
  - 1:00pm \- 5:00pm \= Batch 2
- every 2 hrs
  - 8:00am \- 10:00am \= Batch 1
  - 10:00am \- 11:00am \= Batch 2 part 1
  - 11:00am \- 12:00pm \= Lunch Break
  - 12:00pm \- 1:00pm \= Batch part 2
  - 1:00pm \- 3:00pm \= Batch 3
  - 3:00pm \- 5:00pm \= Batch 4
- every end of day
  - 8:00am \- 5:00pm \= Batch 1

- Do not include shoe types in the system: no more shoe types since Cpoint said that leather rolls are not specified to be only used on one shoe type
- If leather defects consists of more than 10% of the leather roll \-\> return to supplier (find a way to replicate this process, maybe by detecting the total size of the leather roll then formulate a formula on how to calculate this)
- Check if yolo is capable of capturing a whole leather roll for example:
  - Capture 1: what the camera is capable of capturing
  - Capture 2: next until the leather roll is captured as a whole
  - The total size then adds up according to the scans
- CPoint said that they can make a way for it to be usable:
  - small cuts
  - creases
- defects that are irreparable or strictly not accepted by cpoint:
  - large cuts
  - holes
  - stretch marks
- There will no longer be a “for repair” status for the leather since CPoint mentioned that the repair station that they have is only focused on finished shoe products, not raw leather materials. So they want this then our yolo now only serves two outcomes which is Pass or Rejected

More things to note:

- QI will be the one to finish the batches (interval check in)
- Batches will now be determined by the intervals example if check in is every 4 hrs
  - 8:00am \- 1:00pm \= Batch 1
  - 1:00pm \- 5:00pm \= Batch 2
  - QIs are notified on the system based on the their check in time that is set up by the FM, for example if check in is at 5:00pm (end of day) then they will receive a notification 10mins before and at 5:00pm exactly
- Review Queue is no longer needed since QI only need to inspect finished shoes not raw leather materials
- There will no longer be a salvage module, instead after every scan is a reported "for salvage" and will now only be used for reports/data analytics
- Inventory Module: Floor Manager manually edits and inputs quantities for all materials. CPoint stated that they count inventory every end of week or twice a week. (Recommend an approach for this. Additionally, if there are reports that can be tied to this, let me know like maybe consumption comparison by week)

STRICTLY for demo purposes only

- Add a quick sign in on the login page
- Add a reset seed data button on the login page

Module Access (Updated, STRICTLY what they should only see now on their end):

- Shoe Constructor
  - Capture
  - Add a mobile view layout
- Quality Inspector (QI)
  - now only contains Batches Module (notified every interval for check in and finishing of batches)
  - When the QI enters a submission to finish a batch, this will now affect the status of the batches (recommend an approach that is fitting for this type of process)
  - Add a mobile view layout
- Floor Manager
  - Batch
  - Attendance
  - Reports
  - Inventory
- System Admin
  - Now only sees administration modules
