import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  add: vi.fn(),
  archive: vi.fn(),
  copy: vi.fn(),
  create: vi.fn(),
  publish: vi.fn(),
  save: vi.fn(),
  updateEntry: vi.fn(),
  updateTemplate: vi.fn(),
}));

vi.mock("@/app/attendance/roster/actions", () => ({
  addPublishedRosterEntryAction: actions.add,
  archiveShiftTemplateAction: actions.archive,
  copyRosterWeekAction: actions.copy,
  createShiftTemplateAction: actions.create,
  publishRosterWeekAction: actions.publish,
  saveRosterDraftAction: actions.save,
  updatePublishedRosterEntryAction: actions.updateEntry,
  updateShiftTemplateAction: actions.updateTemplate,
}));

import { RosterPlanner } from "@/components/attendance/roster-planner";

const success = { status: "success" as const, message: "Berhasil." };
const outlet = { id: "outlet-1", code: "JKT", name: "Jakarta", timezone: "Asia/Jakarta" };
const staff = [{ id: "staff-1", name: "Ayu", email: "ayu@example.com", role: "staff", jobPosition: { id: "position-1", name: "Pelayan" } }];
const templates = [{ id: "shift-1", name: "Pagi", startTime: "08:00", endTime: "16:00", updatedAt: "2026-08-11T01:00:00.000Z" }];
const week = { id: "week-1", status: "PUBLISHED" as const, publishedAt: "2026-08-11T01:00:00.000Z", updatedAt: "2026-08-11T01:00:00.000Z", entries: [{ id: "entry-1", userId: "staff-1", workDate: "2099-08-10", shiftTemplateId: "shift-1", shiftName: "Pagi", scheduledStartAt: "2099-08-10T01:00:00.000Z", scheduledEndAt: "2099-08-10T09:00:00.000Z", updatedAt: "2026-08-11T01:00:00.000Z" }] };

describe("responsive roster planner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(actions).forEach((action) => action.mockResolvedValue(success));
  });

  it("opens template editing and confirms archival from the active template card", async () => {
    const user = userEvent.setup();
    render(<RosterPlanner outlet={outlet} staff={staff} templates={templates} week={week} weekStart="2099-08-10" />);
    const templateCard = screen.getByRole("heading", { name: "Pagi" }).closest("article");
    expect(templateCard).not.toBeNull();

    await user.click(within(templateCard!).getByRole("button", { name: "Ubah" }));
    expect(screen.getByRole("heading", { name: "Ubah template shift" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Nama shift" })).toHaveValue("Pagi");
    await user.click(screen.getByRole("button", { name: "Batal" }));

    await user.click(within(templateCard!).getByRole("button", { name: "Arsipkan" }));
    expect(screen.getByText(/tidak dapat dipilih untuk roster baru/i)).toBeVisible();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Arsipkan" }));
    await waitFor(() => expect(actions.archive).toHaveBeenCalledWith({ id: "shift-1", outletId: "outlet-1", expectedUpdatedAt: templates[0].updatedAt }));
  });

  it("adds a shift to a published Libur cell with a mandatory reason", async () => {
    const user = userEvent.setup();
    render(<RosterPlanner outlet={outlet} staff={staff} templates={templates} week={week} weekStart="2099-08-10" />);

    await user.click(screen.getAllByRole("button", { name: "Tambah shift" })[0]);
    await user.type(screen.getByRole("textbox", { name: "Alasan perubahan" }), "Menggantikan staf yang izin");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    await waitFor(() => expect(actions.add).toHaveBeenCalledWith(expect.objectContaining({ rosterWeekId: "week-1", outletId: "outlet-1", userId: "staff-1", shiftTemplateId: "shift-1", reason: "Menggantikan staf yang izin" })));
  });

  it("offers Libur when revising an existing future published shift", async () => {
    const user = userEvent.setup();
    render(<RosterPlanner outlet={outlet} staff={staff} templates={templates} week={week} weekStart="2099-08-10" />);

    await user.click(screen.getAllByRole("button", { name: "Ubah" })[0]);
    const schedule = screen.getByRole("combobox", { name: "Jadwal baru" });
    await user.clear(schedule);
    await user.type(schedule, "Libur");
    await user.click(await screen.findByRole("option", { name: /Libur/ }));
    await user.type(screen.getByRole("textbox", { name: "Alasan perubahan" }), "Staf mendapat jadwal libur");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    await waitFor(() => expect(actions.updateEntry).toHaveBeenCalledWith(expect.objectContaining({ entryId: "entry-1", shiftTemplateId: null, reason: "Staf mendapat jadwal libur" })));
  });
});
