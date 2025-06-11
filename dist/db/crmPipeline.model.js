import mongoose from "mongoose";
const Schema = mongoose.Schema;

const TRIGGER_ACTIONS = ["success", "contact_received", "interest_shown", "closed"];

const softDeletePlugin = (schema) => {
    schema.add({
      deletedAt: { type: Date, default: null },
      restored_at: { type: Date, default: null },
    });
  
    schema.pre(/^find/, function (next) {
      if (!this.getQuery().hasOwnProperty("deletedAt")) {
        this.where({ deletedAt: null });
      }
      next();
    });
  
    schema.methods.softDelete = function () {
      this.deletedAt = new Date();
      this.restored_at = null;
      return this.save();
    };
  
    schema.methods.restore = function () {
      this.deletedAt = null;
      this.restored_at = new Date();
      return this.save();
    };
  };

const crmPipelinesSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  remote_name: { type: String, required: true, maxlength: 1000 },
  remote_step_id: { type: String, maxlength: 1000, default: null },
  remote_pipeline_id: { type: Number, default: null },
  trigger: { type: String, enum: TRIGGER_ACTIONS, required: true },
  updated_at: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
  restored_at: { type: Date, default: null },
  transaction_id: { type: String, default: null },
});


crmPipelinesSchema.plugin(softDeletePlugin);

const CrmPipeline = mongoose.model("CrmPipeline", crmPipelinesSchema);
export default CrmPipeline;