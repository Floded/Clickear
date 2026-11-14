import { Router } from "express";
import { z } from "zod";
import { assignmentService } from "./assignment.service.js";
import { createAssignmentSchema, listAssignmentsQuerySchema, returnAssignmentSchema, } from "./assignment.dto.js";
import { fileDateSuffix, sendExcel, } from "../../shared/excel.js";
export const assignmentRouter = Router();
assignmentRouter.get("/", async (req, res) => {
    const query = listAssignmentsQuerySchema.parse(req.query);
    res.json(await assignmentService.list(query));
});
// Exportación a Excel de las asignaciones que cumplan los filtros (sin paginar)
assignmentRouter.get("/export", async (req, res) => {
    const query = listAssignmentsQuerySchema.parse(req.query);
    const rows = await assignmentService.exportRows(query);
    const sheet = {
        name: "Asignaciones",
        columns: [
            { header: "Ítem", width: 34 },
            { header: "Proveedor", width: 24 },
            { header: "Empleado", width: 28 },
            { header: "Cantidad", width: 10 },
            { header: "Entrega", width: 14 },
            { header: "Devolución", width: 14 },
            { header: "Estado", width: 12 },
            { header: "Notas", width: 40 },
        ],
        rows,
    };
    await sendExcel(res, `asignaciones-${fileDateSuffix()}.xlsx`, [sheet]);
});
// Entrega de stock a un empleado: valida disponible y descuenta en una transacción atómica
assignmentRouter.post("/", async (req, res) => {
    const input = createAssignmentSchema.parse(req.body);
    const assignment = await assignmentService.create(input);
    res.status(201).json(assignment);
});
// Devolución al depósito (total o parcial): re-suma stock y cierra la asignación
assignmentRouter.put("/:id/return", async (req, res) => {
    const id = assignmentIdParamsSchema.parse(req.params).id;
    const input = returnAssignmentSchema.parse(req.body);
    res.json(await assignmentService.return(id, input));
});
const assignmentIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
});
//# sourceMappingURL=assignment.routes.js.map