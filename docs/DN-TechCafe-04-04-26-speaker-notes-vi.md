# DN TechCafe 04_04_26 — Ghi chú người nói (tiếng Việt)

**Bản tiếng Anh:** [DN-TechCafe-04-04-26-speaker-notes.md](./DN-TechCafe-04-04-26-speaker-notes.md)

**Slide:** *Copy of DN TechCafe 04_04_26 - New Master Slide.pptx* (xuất PDF)  
**Chủ đề:** Từ ý tưởng đến tác động — phần mềm đang thay đổi thế nào trong kỷ nguyên AI (KMS TechCafe)  
**Trọng tâm phần bạn nói:** Hướng dẫn agent (prompt), điều phối đa agent, RAG, và cách gắn vào sản phẩm thật.

Dùng tài liệu này làm **ý chính từng slide** khi trình bày và **kịch bản mở rộng** khi tập dượt hoặc chia sẻ bản viết.

---

## Cách dùng tài liệu

| Phần | Khi nào dùng |
|------|----------------|
| **Ý chính theo slide** | Trên sân khấu / chế độ presenter — lướt giữa các slide |
| **Kịch bản mở rộng** | Đọc bản đầy đủ, dry run, hoặc gửi kèm tài liệu |
| **Đi sâu** | Khán giả hỏi “vậy build thực tế thế nào?” |
| **Ngân hàng Q&A** | Chuẩn bị câu hỏi kỹ thuật / sản phẩm |

---

## Mở đầu (trước / cùng slide 1)

### Ý chính

- Phần mềm đang chuyển từ **màn hình và form** sang **hệ thống theo đuổi mục tiêu**: suy luận, nhớ, gọi công cụ, phối hợp với nhau.
- Mô hình tinh thần đơn giản: **agent = một hệ điều hành thu nhỏ** — không phải “chatbot thông minh hơn”, mà là vòng lặp **chỉ dẫn + model + bộ nhớ + tools + guardrails + output có cấu trúc**.
- Liên hệ với **cách viết prompt** (nhất là khi nhiều agent) và **RAG** để câu trả lời bám **dữ liệu của bạn**.

### Kịch bản mở rộng (khoảng 1–2 phút)

> Chào buổi [sáng/chiều] cả nhà. Cảm ơn mọi người đã tới KMS TechCafe.  
>  
> Nhiều team đang thử “tính năng AI”. Điều đang đổi là **hình dạng** phần mềm chúng ta ship: từ giao diện chỉ phản hồi khi click, sang hệ thống có thể **theo đuổi mục tiêu** — làm rõ ý định, dùng API và file, nhớ ngữ cảnh, đôi khi **chuyển việc cho agent chuyên biệt khác**.  
>  
> Trong vài phút tới mình muốn đưa một **khung thực dụng** cho sự chuyển đổi đó — không buzzword. Ta sẽ xem **sáu thành phần** mọi stack agent nghiêm túc đều có, **cách viết instruction** để hành vi dự đoán được, **RAG** nối model với tri thức nội bộ, và **nhiều agent** được điều phối thế nào mà không hỗn loạn.  
>  
> Mục tiêu đơn giản: khi ra về, bạn giải thích cho team được *vì sao* “hãy chuyên nghiệp” là instruction tệ, và *vì sao* retrieval thường thắng fine-tuning cho kiến thức nội bộ hay đổi.

---

## Slide 2 — Mục lục

### Ý chính

- **Agentic software** là gì (định nghĩa + ẩn dụ).
- **Các thành phần** làm nó chạy.
- **Bức tranh hiện đại** — tools, MCP, memory, RAG, orchestration, guardrails, skills.
- **Q&A** rồi **kết**.

### Kịch bản mở rộng (khoảng 30 giây)

> Đây là lộ trình. Ta định nghĩa agent, mở stack ra, rồi nối với những gì ngành đang ship — kể cả cách giữ hệ thống an toàn và quan sát được. Cuối giờ để thời gian hỏi đáp thoải mái.

---

## Slide 3 — Agent là gì?

### Ý chính

- **Định nghĩa:** Hệ thống dùng AI để **theo đuổi mục tiêu** và **hoàn thành tác vụ** — không chỉ sinh văn bản.
- **Ẩn dụ:** Agent như **một người trong tổ chức** — cộng tác với người khác vì kết quả chung.
- **Hệ quả:** Thiết kế quan trọng — **vai trò, bàn giao, trách nhiệm** — giống thiết kế tổ chức.

### Kịch bản mở rộng (khoảng 1 phút)

> Khi nói “agent”, mình nói phần mềm **lặp**: quan sát, quyết định làm gì, **hành động** qua tools, cập nhật kế hoạch.  
>  
> Khác với one-shot completion. Chatbot cổ điển chủ yếu *trả lời*. Agent *cố hoàn thành việc* — đôi khi qua nhiều bước.  
>  
> Mình thích ẩn dụ tổ chức: một agent giỏi nghiên cứu, một giỏi định dạng, một giỏi gọi API nội bộ. Việc của người build là cho mỗi agent **ủy nhiệm rõ** và **ranh giới an toàn**, như với người trong team.

---

## Slide 4 — Phần mềm agentic: sáu thành phần lõi

### Ý chính

1. **Instructions** — System prompt: persona, quy tắc, mục tiêu (*prompting* trong production).
2. **LLM** — Động cơ suy luận (GPT, Claude, Gemini, Llama…); **chọn model = đánh đổi chi phí, độ trễ, chất lượng**.
3. **Memory** — Ngắn + dài hạn: hội thoại, nhớ ngữ nghĩa, tóm tắt bền.
4. **Tools** — API, file, DB — **sự thật** và **tác dụng phụ** nằm ở đây, không nằm trong weights.
5. **Guardrails** — Kiểm tra đầu vào/đầu ra; giảm lạm dụng, rò rỉ, hành động sai.
6. **Output** — JSON / Zod / schema — bàn giao **máy đọc được** cho phần còn lại của app.

**Câu cần ghi nhớ:** *“Coi như một hệ điều hành trọn vẹn — thiếu một lớp là hệ thống dễ gãy.”*

### Kịch bản mở rộng (khoảng 2–3 phút)

> Làm cụ thể: mọi agent production mình thấy đều có **sáu lớp**.  
>  
> **Instructions** không phải “văn trang trí”. Đó là **hợp đồng** hành vi: bạn là ai, thành công là gì, tuyệt đối không làm gì, output ra sao. Slide sau so instruction tốt/xấu.  
>  
> **Model** là động cơ. Cùng instruction, hai model có thể khác hẳn — chỉnh **instruction + model + tools** cùng nhau, không tách rời.  
>  
> **Memory** xử lý cửa sổ ngữ cảnh hữu hạn. Không có chiến lược memory, tác vụ dài sẽ **quên mục tiêu** giữa chừng. Ta quay lại working / semantic / observational.  
>  
> **Tools** là cách agent chạm thực tại: CRM, search, file, database. Đây cũng là chỗ **quyền hạn** và **audit** — model đề xuất; code của bạn thực thi.  
>  
> **Guardrails** là lớp an toàn và policy — PII, injection, nội dung độc hại, **duyệt tool call** với hành động phá hủy.  
>  
> Cuối cùng **structured output**: code downstream cần JSON thì nói rõ. Văn xuôi tự do tốn chi phí parse và dễ vỡ trên production.  
>  
> **Insight:** sáu phần **kết hợp**. Instruction yếu làm hỏng cả đống còn lại; tool giỏi không cứu được mục tiêu mơ hồ.

---

## Slide 5 — Định nghĩa instruction cho agent (XẤU vs TỐT)

### Ý chính — Instruction XẤU

- Ví dụ: *“You are an AI assistant. Help the user with their tasks. Be thorough and professional.”*
- **Vấn đề:** (1) Không vai trò thật, (2) từ chủ quan (*thorough*, *professional*), (3) không ranh giới, (4) không hình dạng output.
- **Hệ quả:** Hành vi khó đoán, UX không nhất quán, **khó test**, **rủi ro bảo mật** (agent tự mở rộng phạm vi).

### Ý chính — Instruction TỐT

- Cấu trúc: **Vai trò → Nhiệm vụ → Ranh giới → Output** (và thường có **leo thang**).
- Ví dụ trên slide: reviewer bảo mật Python → JSON có severity, vị trí, rủi ro, đề xuất sửa.
- **Thực hành:** Vai trò rõ, định dạng output **kiểm chứng được**, **được/không được** explicit, **khi nào dừng hoặc escalate**.

**Gợi ý người nói:** Nếu khán giả không phải security engineer, lấy ví dụ **công ty vệ sinh / vận hành nội bộ** — cùng cấu trúc, khác miền.

### Kịch bản mở rộng (khoảng 3–4 phút)

> Đây là slide mình muốn mọi người chụp lại.  
>  
> **Instruction xấu** nghe lịch sự nhưng thực ra **thiếu chi tiết**. “Be thorough” — thorough *theo kiểu nào*? Cho *user nào*? Trong *quy định tuân thủ* nào? “Professional” không phải yêu cầu có thể test. QA không thể assert “professionalness” trong unit test.  
>  
> Tệ hơn: không có ranh giới thì model **lấp chỗ trống** bằng đoán. Đó là lúc hallucination và vi phạm policy — không phải vì model “xấu”, mà vì **bạn không rào sân**.  
>  
> **Instruction tốt** giống **spec** hơn.  
>  
> - **Vai trò:** chuyên môn hẹp — *bạn là X, không phải Y*.  
> - **Nhiệm vụ:** một câu job-to-be-done.  
> - **Ranh giới:** phủ định rõ — *không chạy code*, *không bịa giảm giá không có trong policy*.  
> - **Output:** hình dạng validate được — field JSON, thứ tự bullet, mục bắt buộc.  
>  
> Thêm **escalation**: *độ tin thấp hoặc câu hỏi ngoài phạm vi thì nói rõ và dừng* — automation mới **kiểm toán được**.  
>  
> **Ghi chú đa agent:** Trong supervisor hoặc pipeline, **mỗi agent cần instruction chặt riêng**. Supervisor thường làm *định tuyến và tổng hợp*, không phải “làm hết”. Nếu mọi sub-agent đều mơ hồ, bạn gặp lỗi kiểu **truyền tin** — ngữ cảnh loãng qua mỗi bước.

### Prompting đa agent (điểm nên nhắc, có cơ sở industry)

- **Một agent một việc:** Prompt nhỏ + ít tool hơn → chọn tool đáng tin cậy hơn. Hướng dẫn kỹ thuật Anthropic nhấn mạnh **pattern đơn giản, kết hợp được** hơn là đồ thị đa agent phình to; xem [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents).
- **Payload bàn giao:** Agent A sang B nên truyền **trạng thái có cấu trúc** (mục tiêu, ràng buộc, ý định user, đoạn đã retrieve) — không phải cả tường lịch sử chat.
- **Mô tả tool cũng là prompt:** Model chọn tool từ **tên + mô tả + schema**. Viết như tài liệu API: *khi dùng*, *khi không*, *field bắt buộc*.
- **RAG trước rồi suy luận nhiều bước:** Retrieve trước giảm bịa trên fact nội bộ.

---

## Slide 6 — Tools & Model Context Protocol (MCP)

### Ý chính

- Tools = **khả năng**: API ngoài, file, database.
- **MCP** là cách **chuẩn hóa** để expose tools, resources, prompts cho agent — tích hợp **tái sử dụng** qua client (IDE, assistant, framework).
- **Vì sao quan trọng:** Đổi implementation không phải viết lại mọi agent; **governance** tại ranh giới tool.

### Kịch bản mở rộng (khoảng 1–2 phút)

> Tools là lúc agent ngừng “nói” và bắt đầu **làm**. Search, ticket, billing, code search — đằng sau hàm explicit do code bạn kiểm soát.  
>  
> MCP đáng nhắc vì nó là phần **chuẩn hóa ống nước** — tương tự REST giúp tích hợp lắp ghép. Với doanh nghiệp, lợi ích là **một connector**, nhiều agent — và điểm rõ ràng để **review bảo mật** (tool này đọc/ghi được gì).  
>  
> Tài liệu chính thức: [Model Context Protocol](https://modelcontextprotocol.io/).

---

## Slide 7 — Bộ nhớ agent (Working → Semantic → Observational)

### Ý chính

- **Working memory:** Cửa sổ hội thoại đang hoạt động — **nhanh**, **ngắn hạn**, giữ tác vụ *hiện tại* mạch lạc.
- **Semantic recall:** Lấy lại lượt trước theo **nghĩa** (“lần trước ta quyết billing thế nào?”) — vector similarity, không phải keyword.
- **Observational:** **Nén** lịch sử dài thành ghi chú bền — giữ context nhỏ khi session dài.
- **Vấn đề:** Cắt context → **trôi mục tiêu** trong tác vụ dài.
- **Stack:** Xếp lớp — không phải “chỉ chọn một”.

### Kịch bản mở rộng (khoảng 2 phút)

> Memory không phải “lưu cả chat mãi trong prompt”. Không scale.  
>  
> **Working memory** là buffer lăn — cái *đang* liên quan.  
>  
> **Semantic recall** trả lời “ta đã bàn X” dù user không dùng đúng từ — đó là **embedding search trên message**, không phải grep.  
>  
> **Observational** là cách **tóm và persist** mà không nhét 200 message mỗi lượt. Coi như **sổ ghi chép** của agent.  
>  
> Nếu thấy agent “quên” mục tiêu sau 20 bước, thường là **kiến trúc memory**, không phải “xui”.

---

## Slide 8–9 — RAG (Retrieval-Augmented Generation)

### Ý chính — Vấn đề

- LLM có **knowledge cutoff** và **mặc định không truy cập** corpus riêng.
- **Fine-tuning** tốn kém, chậm làm mới, vẫn không đảm bảo bám fact với tài liệu đổi nhanh.
- **RAG:** Lúc query **retrieve** chunk liên quan, **nhét** vào context, rồi **generate** — kiến thức cập nhật khi **tài liệu** cập nhật.

### Ý chính — Pipeline (đơn giản)

1. **Ingest:** Parse PDF/HTML/docs → **chunk** có overlap.  
2. **Embed:** Vector hóa chunk; lưu **vector DB**.  
3. **Retrieve:** Embed câu hỏi → **nearest neighbors** (+ filter metadata tùy chọn).  
4. **Generate:** Model trả lời **dựa đoạn retrieve**; yêu cầu **trích dẫn** khi cần kiểm toán.

### Ý chính — Chất lượng

- **Chunking** và **metadata** (nguồn, mục, ngày) quan trọng ngang model embedding.
- **Retrieve không phải phép màu** — chunk rác → context rác → sai tự tin. Cần **eval** hit-rate retrieve.
- **RAG vs tool:** Nhiều framework expose retrieve như **tool** agent gọi — hay cho demo vì **thấy tool call** trong trace.

### Kịch bản mở rộng (khoảng 2–3 phút)

> RAG là pattern để nói: **“Trả lời từ *sổ tay, ticket, policy của chúng ta* — không phải từ những gì model học trong training.”**  
>  
> Fine-tuning nhét kiến thức vào weights. Mạnh cho *giọng* hoặc *format*, nhưng đau với **policy đổi hàng tuần**. RAG giữ **source of truth** ở kho tài liệu; đổi khi bạn đổi doc.  
>  
> Vận hành: nghĩ **xưởng + query**:  
>  
> - **Offline:** chunk, embed, index.  
> - **Online:** lấy top-K đoạn, nhét prompt dưới delimiter rõ, instruction: **chỉ dùng context này; thiếu thì nói không biết.**  
>  
> Hệ đa agent thường tách **agent nghiên cứu** (retrieve + trích) và **agent viết** (format) — giảm rủi ro hallucination.  
>  
> Đọc thêm khái niệm: [AWS — What is RAG?](https://aws.amazon.com/what-is/retrieval-augmented-generation/).

---

## Slide 10–11 — Điều phối agent (Swarm, Supervisor, Flow-to-Flow)

### Ý chính

| Pattern | Hình | Điểm mạnh | Dùng khi |
|---------|------|-----------|----------|
| **Swarm** | Peer-to-peer | Song song, khám phá | Brainstorm, research nhiều hướng |
| **Supervisor** | Hub-and-spoke | Kiểm soát, tổng hợp | Workflow doanh nghiệp, phê duyệt |
| **Flow-to-Flow** | Chuỗi tuần tự | Bàn giao tất định | Pipeline tài liệu, kiểu ETL |

**Câu người nói:** *“Chọn orchestration theo nhu cầu **sáng tạo**, **kiểm soát**, hay **tất định**.”*

### Kịch bản mở rộng (khoảng 2 phút)

> Đa agent không phải “nhiều agent = thông minh hơn”. Là **chia việc**.  
>  
> **Swarm** khi cần **song song khám phá** — nhiều peer đề xuất phần giải. Giá là **phối hợp** và debug khó hơn.  
>  
> **Supervisor** là mặc định doanh nghiệp: điều phối **giao việc**, **review**, **gộp** kết quả. Chậm hơn swarm nhưng **dễ quản trị** — biết ai chịu trách nhiệm subtask nào.  
>  
> **Flow-to-flow** là **pipeline**: extract → classify → summarize → store. Hợp bước **tất định**, cần lặp lại.  
>  
> **Hệ quả prompt:** Supervisor cần **luật định tuyến** — *khi nào* gọi chuyên gia nào. Chuyên gia cần **prompt hẹp**. Mọi người đều generalist thì bạn chỉ có một agent đắt đỏ thêm độ trễ.

---

## Slide 12 — Guardrails & human-in-the-loop

### Ý chính

- **Input guards:** PII, injection/jailbreak, toxicity.
- **Output guards:** Rò rỉ, policy, kiểm hallucination khi làm được.
- **HITL:** Duyệt **tool call** (gửi mail, xóa, deploy), **tạm dừng/tiếp**, **escalate khi độ tin thấp**.
- **Token budget** — chặt vòng lặp và chi phí.
- **Observability:** Trace, span, **eval** — app agentic cần hơn log HTTP.

### Kịch bản mở rộng (khoảng 1–2 phút)

> Agent khuếch đại **năng suất và rủi ro**. Guardrails không phải “làm đẹp”.  
>  
> Coi **tool call** như **thay đổi production** — xác nhận hành động phá hủy. Dùng **budget bước/token** để vòng lặp lỗi không đốt hết ngân sách.  
>  
> Đầu tư **quan sát end-to-end**: replay *tài liệu nào* retrieve, *tool nào* chạy, *tham số gì*. Đó là cách debug đa agent — và qua security review.

---

## Slide 13 — Phần mềm agentic hiện đại (“computer use”)

### Ý chính

- Chuyển dịch: chỉ chat → agent **thao tác file**, **chạy code sandbox**, **điều khiển browser** — gần cách con người làm.
- **Sandbox** và **least privilege** là bắt buộc.
- **OpenClaw** / hệ sinh thái: diễn đạt là **tín hiệu nhu cầu**, không endorsement sản phẩm — *“mảng này đang chạy rất nhanh.”*

### Kịch bản mở rộng (khoảng 1 phút)

> Đang có lớp agent không chỉ trả lời — mà **vận hành phần mềm**: file, bảng tính, browser, đôi khi chạy code cô lập.  
>  
> Mạnh cho automation nhưng nâng cao yêu cầu **kiến trúc bảo mật**. Không phải chuyện “cho model quyền root”; mà là **API theo capability**, sandbox, audit trail.

---

## Slide 14 — Agent skills (gói plug-in)

### Ý chính

- **Skill** = gói **instruction + tools + template** theo miền (vd. tạo tài liệu, data analyst, code review).
- **Module hóa:** Mở rộng agent **không** fork core; chia sẻ giữa team.
- Liên hệ **repo demo** nếu có: skill ≈ **playbook lặp lại** cho agent.

### Kịch bản mở rộng (khoảng 1 phút)

> Skill là cách scale hành vi agent **theo chiều ngang** — gói miền cài một lần.  
>  
> Trong tổ chức, giống chia sẻ **lint**, **design system**, **runbook** — chỉ người tiêu thụ là agent và cần **tools** nối đúng.

---

## Slide 15–16 — Q&A và cảm ơn

### Ý chính

- Mời hỏi về **prompting**, **chất lượng RAG**, **orchestration**, **MCP**, **memory**, **eval**, **bảo mật**.
- Kết: **Cảm ơn. Gracias.** — khớp slide đa ngôn ngữ.

### Kịch bản mở rộng (khoảng 30 giây)

> Ta đã đi qua stack — instruction, model, memory, tools, guardrails, output — và chỗ RAG + đa agent khớp nhau thế nào. Mình sẵn sàng đi sâu: metric retrieve, thiết kế supervisor, hoặc pilot an toàn trên sản phẩm thật. Cảm ơn mọi người — cảm ơn, gracias.

---

## Ngân hàng Q&A (trả lời ngắn, có thể mở rộng)

**H: Có RAG rồi còn cần fine-tuning không?**  
Thường **RAG trước** cho kiến thức fact hay đổi; **fine-tuning** cho giọng, format, từ vựng miền — giải bài toán khác nhau.

**H: Biết RAG “chạy tốt” thế nào?**  
Đo **tỷ lệ retrieve đúng**, **độ bám nguồn** (trích dẫn khớp tài liệu), **sửa của user** — không chỉ “nghe hay”.

**H: Một agent hay nhiều agent?**  
Bắt đầu **một agent + tool tốt + RAG**. Tách khi **bộ tool** hoặc **prompt** xung đột — thường từ ~8 tool trở lên hoặc miền lẫn nhau.

**H: Sai lầm lớn nhất team hay mắc?**  
**System prompt mơ hồ** + **không eval** + **quyền tool không giới hạn**.

**H: MCP vs API tùy chỉnh?**  
MCP là **tương tác liên hệ thống**; phía sau vẫn cần **authz**, **rate limit**, **logging**.

---

## Gợi ý demo trực tiếp (Mastra / repo TechCafe)

Nếu demo project TechCafe:

1. **Agent instruction xấu vs tốt** — cùng một câu hỏi, so sánh cấu trúc và giọng an toàn.  
2. **Agent RAG** — xem **tool call** + chunk retrieve trong trace Studio.  
3. **Câu kết:** *“Instruction định hình hành vi; RAG và tools định hình sự thật.”*

---

## Tài liệu tham khảo

- [Model Context Protocol](https://modelcontextprotocol.io/) — chuẩn tool/resource cho agent.  
- [Mastra — Agents](https://mastra.ai/docs/agents/overview) — pattern agent + tool (khớp stack demo).  
- [Mastra — RAG](https://mastra.ai/docs/rag/overview) — khung ingest, embed, retrieve.  
- [AWS — RAG là gì?](https://aws.amazon.com/what-is/retrieval-augmented-generation/) — giải thích trung lập.  
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) — pattern đơn giản, tool/ACI.  

---

*Bản tiếng Việt căn theo nội dung slide PDF và bản speaker notes tiếng Anh; phần đa agent/RAG bổ sung cho tập dượt và khán giả kỹ thuật.*
